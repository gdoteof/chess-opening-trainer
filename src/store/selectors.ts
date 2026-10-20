import { createSelector } from '@reduxjs/toolkit'
import { config } from '../config'
import { bestLine, type PositionAnalysis } from '../domain/analysis'
import { fenKey, sideToMove } from '../domain/chess'
import { negate, type Score } from '../domain/score'
import { currentFenOf } from './gameSlice'
import type { RootState } from './index'

export const selectGame = (state: RootState) => state.game

export const selectCurrentFen = (state: RootState) => currentFenOf(state.game)

/** Every position of the game so far, starting position first. */
export const selectGameFens = createSelector([selectGame], (game) => [game.startFen, ...game.moves.map((m) => m.fen)])

export const selectAnalysis = (state: RootState, fen: string): PositionAnalysis | undefined =>
  state.engine.analyses[fenKey(fen)]

/** The position shown on the board: a proof position while a proof is open, else the game. */
export const selectBoardFen = (state: RootState): string => {
  const proof = state.game.review?.proof
  if (proof) return proof.cursor === 0 ? state.game.review!.preFen : proof.moves[proof.cursor - 1].fen
  return selectCurrentFen(state)
}

/** The last move shown on the board, for highlighting. */
export const selectBoardLastMove = (state: RootState) => {
  const proof = state.game.review?.proof
  if (proof) return proof.cursor === 0 ? undefined : proof.moves[proof.cursor - 1]
  return state.game.moves.at(-1)
}

/**
 * Analysis of the player's position for coloring destinations: the analysis once it is deep
 * enough, 'pending' while it is not, null when hints don't apply.
 */
export const selectHintAnalysis = (state: RootState): PositionAnalysis | 'pending' | null => {
  if (!state.settings.hints || state.game.phase !== 'player') return null
  const analysis = selectAnalysis(state, selectCurrentFen(state))
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
  switch (game.phase) {
    case 'judging':
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
