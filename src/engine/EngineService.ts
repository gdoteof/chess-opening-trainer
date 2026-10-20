import type { MoveLine, PositionAnalysis } from '../domain/analysis'
import { fenKey } from '../domain/chess'
import type { UciTransport } from './transport'
import { isBestMove, parseInfo } from './uci'

export interface AnalysisLimits {
  depth: number
  timeMs: number
}

export interface AnalysisRequest {
  fen: string
  /** Number of moves to rank; pass the number of legal moves to analyze every move. */
  multiPv: number
  limits: AnalysisLimits
  /** Called each time every line has reached a new depth. */
  onUpdate?: (analysis: PositionAnalysis) => void
}

export interface AnalysisJob {
  readonly fen: string
  /** The deepest analysis reached, or null if the job was cancelled before any. */
  readonly result: Promise<PositionAnalysis | null>
  /** Stops the search if it is running, or drops it from the queue. */
  cancel(): void
}

interface Job extends AnalysisJob {
  request: AnalysisRequest
  cancelled: boolean
  slots: Map<number, MoveLine>
  latest: PositionAnalysis | null
  resolve(analysis: PositionAnalysis | null): void
}

export interface EngineOptions {
  threads: number
  hashMb: number
}

/**
 * Runs one search at a time over a UCI transport, queueing the rest. A new search is never
 * started until the previous one has reported `bestmove`, so output is never misattributed.
 */
export class EngineService {
  private readonly transport: UciTransport
  private readonly queue: Job[] = []
  private current: Job | null = null
  private pendingNewGame = false

  constructor(transport: UciTransport) {
    this.transport = transport
    transport.listen((line) => this.onLine(line))
  }

  async init(options: EngineOptions): Promise<void> {
    await this.handshake('uci', 'uciok')
    this.transport.send(`setoption name Threads value ${options.threads}`)
    this.transport.send(`setoption name Hash value ${options.hashMb}`)
    await this.handshake('isready', 'readyok')
  }

  /** Clears the engine's hash before the next search; only call between games. */
  newGame(): void {
    this.pendingNewGame = true
  }

  analyze(request: AnalysisRequest): AnalysisJob {
    let resolve!: (analysis: PositionAnalysis | null) => void
    const result = new Promise<PositionAnalysis | null>((r) => (resolve = r))
    const job: Job = {
      fen: request.fen,
      request,
      result,
      resolve,
      cancelled: false,
      slots: new Map(),
      latest: null,
      cancel: () => this.cancel(job),
    }
    this.queue.push(job)
    this.startNext()
    return job
  }

  terminate(): void {
    this.transport.terminate()
  }

  private handshake(command: string, reply: string): Promise<void> {
    return new Promise((resolve) => {
      const stop = this.transport.listen((line) => {
        if (line.trim() === reply) {
          stop()
          resolve()
        }
      })
      this.transport.send(command)
    })
  }

  private cancel(job: Job): void {
    if (job.cancelled) return
    job.cancelled = true
    const queued = this.queue.indexOf(job)
    if (queued >= 0) {
      this.queue.splice(queued, 1)
      job.resolve(null)
    } else if (this.current === job) {
      this.transport.send('stop')
    }
  }

  private startNext(): void {
    if (this.current) return
    const job = this.queue.shift()
    if (!job) return
    this.current = job
    if (this.pendingNewGame) {
      this.transport.send('ucinewgame')
      this.pendingNewGame = false
    }
    const { fen, multiPv, limits } = job.request
    this.transport.send(`setoption name MultiPV value ${Math.max(1, multiPv)}`)
    this.transport.send(`position fen ${fen}`)
    this.transport.send(`go depth ${limits.depth} movetime ${limits.timeMs}`)
  }

  private onLine(line: string): void {
    const job = this.current
    if (!job) return
    if (isBestMove(line)) {
      this.current = null
      const latest = job.latest && { ...job.latest, complete: !job.cancelled }
      job.resolve(latest)
      this.startNext()
      return
    }
    if (job.cancelled) return
    const info = parseInfo(line)
    if (!info || info.bound) return
    job.slots.set(info.multipv, { move: info.pv[0], depth: info.depth, score: info.score, pv: info.pv })
    const expected = Math.max(1, job.request.multiPv)
    if (info.multipv === expected && job.slots.size >= expected) {
      job.latest = snapshot(job.request.fen, job.slots)
      job.request.onUpdate?.(job.latest)
    }
  }
}

function snapshot(fen: string, slots: Map<number, MoveLine>): PositionAnalysis {
  const lines: Record<string, MoveLine> = {}
  let depth = Infinity
  for (const line of slots.values()) {
    lines[line.move] = line
    depth = Math.min(depth, line.depth)
  }
  return { fenKey: fenKey(fen), depth, lines, complete: false }
}
