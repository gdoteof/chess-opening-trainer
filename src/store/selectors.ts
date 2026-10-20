import { createSelector } from '@reduxjs/toolkit'
import { config } from '../config'
import { bestLine, type PositionAnalysis } from '../domain/analysis'
import { fenKey, sideToMove, START_FEN } from '../domain/chess'
import { negate, type Score } from '../domain/score'
import { currentFenOf } from './gameSlice'
import type { RootState } from './index'

export const selectGame = (state: RootState) => state.game

export const selectCurrentFen = (state: RootState) => currentFenOf(state.game)

/** Every position of the game so far, starting position first. */
export const selectGameFens = createSelector([selectGame], (game) => [game.startFen, ...game.moves.map((m) => m.fen)])

/** Choosing an opening, with the board as an explorer of book moves. */
export const selectExploring = (state: RootState) => state.settings.mode === 'openings' && state.openings.browsing

export const selectExplorerFen = (state: RootState) => state.openings.explorer.at(-1)?.fen ?? START_FEN

export const selectExplorerFens = createSelector([(state: RootState) => state.openings.explorer], (moves) => [
  START_FEN,
  ...moves.map((m) => m.fen),
])

/** Lines of the chosen opening already finished in the current practice. */
export const selectFinishedLines = createSelector(
  [(state: RootState) => state.openings.progress, (state: RootState) => state.openings.practice],
  (progress, practice) => new Set(progress[practice]),
)

export const selectAnalysis = (state: RootState, fen: string): PositionAnalysis | undefined =>
  state.engine.analyses[fenKey(fen)]

/** The position shown on the board: the explorer, a proof position while a proof is open, else the game. */
export const selectBoardFen = (state: RootState): string => {
  if (selectExploring(state)) return selectExplorerFen(state)
  const proof = state.game.review?.proof
  if (proof) return proof.cursor === 0 ? state.game.review!.preFen : proof.moves[proof.cursor - 1].fen
  return selectCurrentFen(state)
}

/** The last move shown on the board, for highlighting. */
export const selectBoardLastMove = (state: RootState) => {
  if (selectExploring(state)) return state.openings.explorer.at(-1)
  const proof = state.game.review?.proof
  if (proof) return proof.cursor === 0 ? undefined : proof.moves[proof.cursor - 1]
  return state.game.moves.at(-1)
}

/**
 * Analysis of the position the player is moving in, for coloring destinations: the analysis
 * once it is deep enough, 'pending' while it is not, null when hints don't apply.
 */
export const selectHintAnalysis = (state: RootState): PositionAnalysis | 'pending' | null => {
  if (!state.settings.hints) return null
  const fen = selectExploring(state)
    ? selectExplorerFen(state)
    : state.game.phase === 'player'
      ? selectCurrentFen(state)
      : null
  if (!fen) return null
  const analysis = selectAnalysis(state, fen)
  return analysis && analysis.depth >= config.analysis.minDepth ? analysis : 'pending'
}

/** Evaluation of the board position from the player's perspective, if known. */
export const selectBoardEval = (state: RootState): { score: Score; depth: number } | null => {
  const fen = selectBoardFen(state)
  const analysis = selectAnalysis(state, fen)
  const best = analysis && bestLine(analysis)
  if (best && analysis) {
    const score = sideToMove(fen) === state.game.player ? best.score : negate(best.score)
    return { score, depth: analysis.depth }
  }
  const proof = state.game.review?.proof
  return proof ? { score: proof.evaluation, depth: 0 } : null
}

/** The position the engine should be working on now, in priority order; null for none. */
export const selectAnalysisTarget = (state: RootState): string | null => {
  const { game } = state
  const review = game.review
  if (review?.proof?.status.kind === 'needsMore') return review.proof.status.fromFen
  if (game.phase === 'judging') return review?.preFen ?? null
  if (selectExploring(state)) return selectExplorerFen(state)
  switch (game.phase) {
    case 'review':
      return review?.preFen ?? null
    case 'opponent':
      return game.mode === 'bot' ? selectCurrentFen(state) : null
    case 'player':
      return selectCurrentFen(state)
    default:
      return null
  }
}

export const isAnalysisDone = (analysis: PositionAnalysis | undefined) =>
  !!analysis && (analysis.complete || analysis.depth >= config.analysis.targetDepth)
