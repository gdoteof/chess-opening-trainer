import { describe, expect, it } from 'vitest'
import { EngineService } from './EngineService'
import type { UciTransport } from './transport'
import { parseInfo } from './uci'

class FakeEngine implements UciTransport {
  sent: string[] = []
  private listeners = new Set<(line: string) => void>()

  send(command: string) {
    this.sent.push(command)
    if (command === 'uci') this.emit('uciok')
    if (command === 'isready') this.emit('readyok')
  }
  listen(listener: (line: string) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  terminate() {}
  emit(line: string) {
    ;[...this.listeners].forEach((listener) => listener(line))
  }
  gos() {
    return this.sent.filter((c) => c.startsWith('go') || c.startsWith('position'))
  }
}

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const OTHER = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const limits = { depth: 18, timeMs: 3000 }

describe('parseInfo', () => {
  it('reads depth, multipv, score and pv', () => {
    expect(parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1234 nps 5 pv e7e5 g1f3')).toEqual({
      depth: 12,
      multipv: 2,
      score: { kind: 'cp', value: -35 },
      bound: false,
      pv: ['e7e5', 'g1f3'],
    })
    expect(parseInfo('info depth 9 multipv 1 score mate -3 lowerbound pv a1a2')?.bound).toBe(true)
    expect(parseInfo('info string NNUE evaluation using nn.nnue')).toBeNull()
    expect(parseInfo('info depth 0 score mate 0')).toBeNull()
  })
})

describe('EngineService', () => {
  it('emits progress once every line reaches a depth, then resolves on bestmove', async () => {
    const fake = new FakeEngine()
    const engine = new EngineService(fake)
    await engine.init({ threads: 2, hashMb: 16 })
    const depths: number[] = []
    const job = engine.analyze({ fen: FEN, multiPv: 2, limits, onUpdate: (a) => depths.push(a.depth) })
    expect(fake.sent).toContain('setoption name MultiPV value 2')
    expect(fake.sent).toContain('go depth 18 movetime 3000')

    fake.emit('info depth 1 multipv 1 score cp 30 pv e2e4')
    fake.emit('info depth 1 multipv 2 score cp 20 pv d2d4')
    fake.emit('info depth 2 multipv 1 score cp 35 pv d2d4 d7d5')
    fake.emit('info depth 2 multipv 2 score cp 25 lowerbound pv e2e4')
    fake.emit('info depth 2 multipv 2 score cp 25 pv e2e4 e7e5')
    fake.emit('bestmove d2d4')

    const result = await job.result
    expect(depths).toEqual([1, 2])
    expect(result?.complete).toBe(true)
    expect(result?.lines.d2d4.pv).toEqual(['d2d4', 'd7d5'])
    expect(result?.lines.e2e4.score).toEqual({ kind: 'cp', value: 25 })
  })

  it('waits for bestmove after stop before starting the next search', async () => {
    const fake = new FakeEngine()
    const engine = new EngineService(fake)
    const first = engine.analyze({ fen: FEN, multiPv: 1, limits })
    const second = engine.analyze({ fen: OTHER, multiPv: 1, limits })
    fake.emit('info depth 5 multipv 1 score cp 30 pv e2e4')
    first.cancel()
    expect(fake.sent.at(-1)).toBe('stop')
    expect(fake.gos()).toHaveLength(2)

    fake.emit('info depth 6 multipv 1 score cp 99 pv g1f3')
    fake.emit('bestmove e2e4')
    const cancelled = await first.result
    expect(cancelled?.depth).toBe(5)
    expect(cancelled?.complete).toBe(false)
    expect(fake.gos().at(-2)).toBe(`position fen ${OTHER}`)

    fake.emit('info depth 1 multipv 1 score cp -20 pv e7e5')
    fake.emit('bestmove e7e5')
    expect((await second.result)?.lines.e7e5).toBeDefined()
  })

  it('drops queued jobs that are cancelled', async () => {
    const fake = new FakeEngine()
    const engine = new EngineService(fake)
    engine.analyze({ fen: FEN, multiPv: 1, limits })
    const queued = engine.analyze({ fen: OTHER, multiPv: 1, limits })
    queued.cancel()
    expect(await queued.result).toBeNull()
    fake.emit('bestmove e2e4')
    expect(fake.gos()).toHaveLength(2)
  })

  it('sends ucinewgame only before the next search', () => {
    const fake = new FakeEngine()
    const engine = new EngineService(fake)
    engine.newGame()
    expect(fake.sent).not.toContain('ucinewgame')
    engine.analyze({ fen: FEN, multiPv: 1, limits })
    expect(fake.sent[0]).toBe('ucinewgame')
  })
})
