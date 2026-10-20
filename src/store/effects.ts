import { config } from '../config'
import { bestLine, type MoveLine } from '../domain/analysis'
import { chooseBotMove } from '../domain/bot'
import { fenKey, legalUcis, playUci, sideToMove, type Color, type FenKey } from '../domain/chess'
import { evaluateProof } from '../domain/proof'
import { isBadQuality, judgeMove } from '../domain/quality'
import { negate } from '../domain/score'
import type { AnalysisJob } from '../engine/EngineService'
import { analysisUpdated } from './engineSlice'
import {
  currentFenOf,
  gameStarted,
  lineCompleted,
  moveJudged,
  opponentMoved,
  proofExtended,
  proofTicked,
  type Proof,
  type Verdict,
} from './gameSlice'
import type { AppListenerApi, AppStartListening, RootState } from './index'
import { isAnalysisDone, selectAnalysis, selectAnalysisTarget } from './selectors'

/** Resolves once `predicate` holds, checking the current state first. */
async function waitFor(api: AppListenerApi, predicate: (state: RootState) => boolean): Promise<void> {
  if (predicate(api.getState())) return
  await api.condition((_action, state) => predicate(state))
}

/**
 * Keeps the single engine busy with whatever position matters most right now (see
 * selectAnalysisTarget), cancelling the running search whenever that changes.
 */
function coordinateAnalysis(startListening: AppStartListening) {
  let running: { job: AnalysisJob; key: FenKey } | null = null
  startListening({
    predicate: () => true,
    effect: (_action, api) => {
      const engine = api.extra.engine.current
      const state = api.getState()
      if (!engine || state.engine.status !== 'ready') return
      const fen = selectAnalysisTarget(state)
      const key = fen && fenKey(fen)
      if (running && running.key === key) return
      running?.job.cancel()
      running = null
      if (!fen || !key || isAnalysisDone(selectAnalysis(state, fen))) return
      const multiPv = legalUcis(fen).length
      if (multiPv === 0) return

      const job = engine.analyze({
        fen,
        multiPv,
        limits: { depth: config.analysis.targetDepth, timeMs: config.analysis.timeBudgetMs },
        onUpdate: (analysis) => api.dispatch(analysisUpdated(analysis)),
      })
      const started = { job, key }
      running = started
      void job.result.then((final) => {
        if (running === started) running = null
        if (final) api.dispatch(analysisUpdated(final))
      })
    },
  })
}

function resetEngineBetweenGames(startListening: AppStartListening) {
  startListening({
    actionCreator: gameStarted,
    effect: (_action, api) => api.extra.engine.current?.newGame(),
  })
}

/** Plays the opponent's move: a random book continuation in drills, the bot's choice otherwise. */
function replyAsOpponent(startListening: AppStartListening) {
  startListening({
    predicate: (_action, state, previous) =>
      state.game.phase === 'opponent' &&
      (previous.game.phase !== 'opponent' ||
        previous.game.id !== state.game.id ||
        previous.game.moves.length !== state.game.moves.length),
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      const game = api.getState().game
      const fen = currentFenOf(game)
      const stillOurTurn = (state: RootState) =>
        state.game.id === game.id && state.game.phase === 'opponent' && state.game.moves.length === game.moves.length

      if (game.mode === 'drill') {
        await api.delay(config.drill.replyDelayMs)
        const state = api.getState()
        if (!stillOurTurn(state) || !state.drill.opening) return
        const options = api.extra.treeFor(state.drill.opening).get(fenKey(fen)) ?? []
        if (options.length === 0) {
          api.dispatch(lineCompleted())
          return
        }
        const uci = options[Math.floor(api.extra.random() * options.length)]
        api.dispatch(opponentMoved(playUci(fen, uci)!))
        return
      }

      const startedAt = Date.now()
      const strength = api.getState().bot.strength
      const ready = (state: RootState) => {
        const analysis = selectAnalysis(state, fen)
        if (!analysis) return false
        return analysis.complete || (strength.kind === 'rating' && analysis.depth >= config.bot.ratedMinDepth)
      }
      await waitFor(api, (state) => !stillOurTurn(state) || ready(state))
      const analysis = selectAnalysis(api.getState(), fen)
      if (!stillOurTurn(api.getState()) || !analysis) return
      const uci = chooseBotMove(analysis, strength, config.quality.evalCapCp, api.extra.random)
      if (!uci) return
      await api.delay(Math.max(0, config.bot.minThinkMs - (Date.now() - startedAt)))
      if (stillOurTurn(api.getState())) api.dispatch(opponentMoved(playUci(fen, uci)!))
    },
  })
}

/** Classifies the player's move once its position is analyzed deeply enough. */
function judgePlayerMoves(startListening: AppStartListening) {
  startListening({
    predicate: (_action, state, previous) =>
      state.game.phase === 'judging' && (previous.game.phase !== 'judging' || previous.game.id !== state.game.id),
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      const game = api.getState().game
      const review = game.review
      if (!review) return
      const stillJudging = (state: RootState) => state.game.id === game.id && state.game.review === review
      const deepEnough = (state: RootState) =>
        (selectAnalysis(state, review.preFen)?.depth ?? 0) >= config.analysis.minDepth

      await waitFor(api, (state) => !stillJudging(state) || state.engine.status === 'failed' || deepEnough(state))
      const state = api.getState()
      if (!stillJudging(state)) return
      const analysis = selectAnalysis(state, review.preFen)
      const judged = analysis && deepEnough(state) ? judgeMove(analysis, review.move.uci, config.quality) : null
      if (!judged) {
        api.dispatch(moveJudged({ verdict: null, proof: null }))
        return
      }
      const verdict: Verdict = {
        quality: judged.quality,
        lossCp: judged.loss,
        bestMove: judged.best.move,
        bestSan: playUci(review.preFen, judged.best.move)?.san ?? judged.best.move,
        bestScore: judged.best.score,
        moveScore: judged.line.score,
      }
      const proof = isBadQuality(judged.quality) ? startProof(review.preFen, judged.line, game.player) : null
      api.dispatch(moveJudged({ verdict, proof }))
    },
  })
}

function startProof(preFen: string, line: MoveLine, player: Color): Proof {
  // The line was analyzed from the player's own position, so its score is already theirs.
  const evaluation = line.score
  const evaluated = evaluateProof({ baseFen: preFen, line: line.pv, player, evaluation }, config.proof)
  return { ...evaluated, line: line.pv, evaluation, cursor: 1, playing: true, reachedEnd: false }
}

/** Advances a playing proof one move per interval. */
function playProofs(startListening: AppStartListening) {
  startListening({
    predicate: (_action, state, previous) => {
      const proof = state.game.review?.proof
      return !!proof?.playing && proof !== previous.game.review?.proof
    },
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      await api.delay(config.proof.plyIntervalMs)
      api.dispatch(proofTicked())
    },
  })
}

/** When a proof's line runs out before its stopping point, continues it with fresh analysis. */
function extendProofs(startListening: AppStartListening) {
  const needsMoreFrom = (state: RootState) => {
    const status = state.game.review?.proof?.status
    return status?.kind === 'needsMore' ? status.fromFen : null
  }
  startListening({
    predicate: (_action, state, previous) =>
      needsMoreFrom(state) !== null &&
      (needsMoreFrom(state) !== needsMoreFrom(previous) || state.game.review !== previous.game.review),
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      const { review, player } = api.getState().game
      const proof = review?.proof
      if (!review || !proof || proof.status.kind !== 'needsMore') return
      const fromFen = proof.status.fromFen
      const sameProof = (state: RootState) => state.game.review?.proof?.line === proof.line
      const ready = (state: RootState) => {
        const analysis = selectAnalysis(state, fromFen)
        return !!analysis && (analysis.complete || analysis.depth >= config.proof.extensionDepth)
      }
      await waitFor(api, (state) => !sameProof(state) || state.engine.status === 'failed' || ready(state))
      const state = api.getState()
      if (!sameProof(state)) return

      const analysis = selectAnalysis(state, fromFen)
      const best = analysis && bestLine(analysis)
      const known = proof.moves.length
      if (!best) {
        api.dispatch(
          proofExtended({
            line: proof.line,
            evaluation: proof.evaluation,
            moves: proof.moves,
            status: { kind: 'stopped', at: known, outcome: { kind: 'positional', evaluation: proof.evaluation } },
          }),
        )
        return
      }
      const line = [...proof.line.slice(0, known), ...best.pv]
      const evaluation = sideToMove(fromFen) === player ? best.score : negate(best.score)
      const evaluated = evaluateProof({ baseFen: review.preFen, line, player, evaluation }, config.proof)
      if (evaluated.status.kind === 'needsMore' && evaluated.moves.length <= known) {
        evaluated.status = { kind: 'stopped', at: known, outcome: { kind: 'positional', evaluation } }
      }
      api.dispatch(proofExtended({ line, evaluation, ...evaluated }))
    },
  })
}

/** Ends a drill when the chosen opening's book has no move left in the current position. */
function completeDrillLines(startListening: AppStartListening) {
  startListening({
    predicate: (_action, state, previous) =>
      state.game.mode === 'drill' &&
      (state.game.phase === 'player' || state.game.phase === 'opponent') &&
      (state.game.moves.length !== previous.game.moves.length ||
        state.game.phase !== previous.game.phase ||
        state.game.id !== previous.game.id),
    effect: (_action, api) => {
      const { game, drill } = api.getState()
      if (!drill.opening) return
      const moves = api.extra.treeFor(drill.opening).get(fenKey(currentFenOf(game)))
      if (!moves?.length) api.dispatch(lineCompleted())
    },
  })
}

export function registerEffects(startListening: AppStartListening) {
  coordinateAnalysis(startListening)
  resetEngineBetweenGames(startListening)
  replyAsOpponent(startListening)
  judgePlayerMoves(startListening)
  playProofs(startListening)
  extendProofs(startListening)
  completeDrillLines(startListening)
}
