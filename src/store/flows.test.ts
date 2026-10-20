import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MoveLine, PositionAnalysis } from '../domain/analysis'
import { buildBook, parseOpeningsTsv } from '../domain/book'
import { fenKey, legalUcis, playUci, START_FEN } from '../domain/chess'
import { cp } from '../domain/score'
import type { AnalysisJob, AnalysisRequest, EngineService } from '../engine/EngineService'
import { botSideChosen, strengthChosen } from './botSlice'
import { browsingStarted, drillSideChosen, explorerUndone, openingChosen } from './drillSlice'
import { engineReady } from './engineSlice'
import { tookBack } from './gameSlice'
import { createAppStore } from './index'
import { createServices } from './services'
import { selectBoardFen, selectExploring } from './selectors'
import { attemptExplorerMove, attemptPlayerMove, chooseOpening, startBotGame, startDrill, switchMode } from './thunks'

/** Answers every search instantly: scripted lines where given, 0.00 for every other move. */
class ScriptedEngine {
  scripts = new Map<string, Record<string, { score: number; pv?: string[] }>>()
  searched: string[] = []

  script(fen: string, lines: Record<string, { score: number; pv?: string[] }>) {
    this.scripts.set(fenKey(fen), lines)
  }

  newGame() {}

  analyze(request: AnalysisRequest): AnalysisJob {
    this.searched.push(request.fen)
    const scripted = this.scripts.get(fenKey(request.fen)) ?? {}
    const lines: Record<string, MoveLine> = {}
    for (const move of legalUcis(request.fen)) {
      const entry = scripted[move] ?? { score: 0 }
      lines[move] = { move, depth: 20, score: cp(entry.score), pv: entry.pv ?? [move] }
    }
    const analysis: PositionAnalysis = { fenKey: fenKey(request.fen), depth: 20, lines, complete: true }
    const result = Promise.resolve().then(() => {
      request.onUpdate?.({ ...analysis, complete: false })
      return analysis
    })
    return { fen: request.fen, result, cancel: () => {} }
  }
}

const tsv = [
  'eco\tname\tpgn',
  'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
  'C40\tKing\'s Knight Opening\t1. e4 e5 2. Nf3',
].join('\n')

function setup() {
  const services = createServices(buildBook(parseOpeningsTsv(tsv)), () => 0)
  const engine = new ScriptedEngine()
  services.engine.current = engine as unknown as EngineService
  const store = createAppStore(services)
  store.dispatch(engineReady({ file: 'fake', threaded: false, threads: 1 }))
  return { store, engine }
}

const after = (...ucis: string[]) => ucis.reduce((fen, uci) => playUci(fen, uci)!.fen, START_FEN)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('opening drill', () => {
  it('replies from the book and stops the player on a non-book move', async () => {
    const { store } = setup()
    store.dispatch(openingChosen('Italian Game'))
    store.dispatch(drillSideChosen('w'))
    store.dispatch(startDrill())
    expect(store.getState().game.phase).toBe('player')

    expect(store.dispatch(attemptPlayerMove('e2e4'))).toBe(true)
    expect(store.getState().game.phase).toBe('opponent')
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.getState().game.moves.map((m) => m.san)).toEqual(['e4', 'e5'])
    expect(store.getState().game.phase).toBe('player')

    store.dispatch(attemptPlayerMove('d2d4'))
    await vi.advanceTimersByTimeAsync(10)
    const { phase, review } = store.getState().game
    expect(phase).toBe('review')
    expect(review?.bookMoves).toEqual([{ uci: 'g1f3', san: 'Nf3' }])
    expect(review?.verdict?.quality).toBe('green')
    expect(review?.proof).toBeNull()

    store.dispatch(tookBack())
    expect(store.getState().game.phase).toBe('player')
    expect(store.getState().game.moves).toHaveLength(2)
  })

  it('reports the line complete when the book runs out', async () => {
    const { store } = setup()
    store.dispatch(openingChosen('Italian Game'))
    store.dispatch(startDrill())
    for (const move of ['e2e4', 'g1f3', 'f1c4']) {
      store.dispatch(attemptPlayerMove(move))
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(store.getState().game.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    expect(store.getState().game.finish).toEqual({ kind: 'lineComplete' })
  })

  it('plays the first move for a player who chose black', async () => {
    const { store } = setup()
    store.dispatch(switchMode('bot'))
    store.dispatch(switchMode('drill'))
    store.dispatch(openingChosen('Italian Game'))
    store.dispatch(drillSideChosen('b'))
    store.dispatch(startDrill())
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.getState().game.moves.map((m) => m.san)).toEqual(['e4'])
    expect(store.getState().game.phase).toBe('player')
  })
})

describe('choosing an opening', () => {
  it('explores book moves on the board before a drill starts', () => {
    const { store } = setup()
    expect(selectExploring(store.getState())).toBe(true)
    expect(store.dispatch(attemptExplorerMove('e2e4'))).toBe(true)
    expect(store.dispatch(attemptExplorerMove('d7d5'))).toBe(false)
    expect(store.dispatch(attemptExplorerMove('e7e5'))).toBe(true)
    expect(selectBoardFen(store.getState())).toBe(after('e2e4', 'e7e5'))
    store.dispatch(explorerUndone())
    expect(selectBoardFen(store.getState())).toBe(after('e2e4'))
  })

  it('starts the chosen drill from the first move and returns to the explorer to change it', async () => {
    const { store } = setup()
    store.dispatch(attemptExplorerMove('e2e4'))
    store.dispatch(chooseOpening('Italian Game'))
    expect(selectExploring(store.getState())).toBe(false)
    expect(selectBoardFen(store.getState())).toBe(START_FEN)
    store.dispatch(attemptPlayerMove('e2e4'))
    await vi.advanceTimersByTimeAsync(1000)

    store.dispatch(browsingStarted())
    expect(selectBoardFen(store.getState())).toBe(after('e2e4'))
    expect(store.dispatch(attemptPlayerMove('g1f3'))).toBe(true)
    expect(store.getState().drill.explorer).toHaveLength(1)
  })
})

describe('play vs bot', () => {
  it('proves a blunder by playing out the refutation', async () => {
    const { store, engine } = setup()
    engine.script(after('e2e4'), { e7e5: { score: 40 } })
    engine.script(after('e2e4', 'e7e5'), {
      g1f3: { score: 30, pv: ['g1f3', 'b8c6'] },
      f1a6: { score: -300, pv: ['f1a6', 'b7a6', 'g1f3', 'g8f6'] },
    })
    store.dispatch(switchMode('bot'))
    store.dispatch(strengthChosen({ kind: 'max' }))
    store.dispatch(botSideChosen('w'))
    store.dispatch(startBotGame())

    store.dispatch(attemptPlayerMove('e2e4'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(store.getState().game.moves.map((m) => m.san)).toEqual(['e4', 'e5'])
    expect(store.getState().game.lastVerdict?.quality).toBe('green')

    store.dispatch(attemptPlayerMove('f1a6'))
    await vi.advanceTimersByTimeAsync(10)
    const { phase, review } = store.getState().game
    expect(phase).toBe('review')
    expect(review?.verdict).toMatchObject({ quality: 'red', bestSan: 'Nf3', lossCp: 330 })
    expect(review?.proof).toMatchObject({ cursor: 1, playing: true })

    await vi.advanceTimersByTimeAsync(2000)
    expect(store.getState().game.review?.proof).toMatchObject({
      cursor: 2,
      playing: false,
      reachedEnd: true,
      status: { kind: 'stopped', at: 2, outcome: { kind: 'material', lossCp: 300 } },
    })

    store.dispatch(tookBack())
    expect(store.getState().game.moves.map((m) => m.san)).toEqual(['e4', 'e5'])
    expect(store.getState().game.phase).toBe('player')
  })

  it('extends a proof whose line runs out with analysis of the last position', async () => {
    const { store, engine } = setup()
    engine.script(after('e2e4'), { e7e5: { score: 40 } })
    engine.script(after('e2e4', 'e7e5'), { f1a6: { score: -300, pv: ['f1a6'] } })
    engine.script(after('e2e4', 'e7e5', 'f1a6'), { b7a6: { score: 300, pv: ['b7a6', 'g1f3'] } })
    store.dispatch(switchMode('bot'))
    store.dispatch(strengthChosen({ kind: 'max' }))
    store.dispatch(startBotGame())
    store.dispatch(attemptPlayerMove('e2e4'))
    await vi.advanceTimersByTimeAsync(2000)
    store.dispatch(attemptPlayerMove('f1a6'))
    await vi.advanceTimersByTimeAsync(3000)

    const proof = store.getState().game.review?.proof
    expect(engine.searched.map(fenKey)).toContain(fenKey(after('e2e4', 'e7e5', 'f1a6')))
    expect(proof?.moves.map((m) => m.san)).toEqual(['Ba6', 'bxa6'])
    expect(proof?.evaluation).toEqual(cp(-300))
    expect(proof?.status).toMatchObject({ kind: 'stopped', outcome: { kind: 'material' } })
  })
})
