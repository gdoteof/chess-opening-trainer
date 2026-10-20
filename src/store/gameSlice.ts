import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { sideToMove, START_FEN, type Color, type PlayedMove, type Uci } from '../domain/chess'
import { gameOutcome, type GameOutcome } from '../domain/outcome'
import type { ProofEvaluation, ProofStatus } from '../domain/proof'
import type { Quality } from '../domain/quality'
import type { Score } from '../domain/score'
import type { Mode } from './settingsSlice'

/**
 * - setup: no game running
 * - player / opponent: whose move it is
 * - judging: the player's move is waiting for enough analysis to be classified
 * - review: play is paused on the player's move (wrong book move and/or blunder proof)
 * - finished: game over, or the drill reached the end of the book
 */
export type Phase = 'setup' | 'player' | 'opponent' | 'judging' | 'review' | 'finished'

export type Finish = { kind: 'outcome'; outcome: GameOutcome } | { kind: 'lineComplete' }

export interface Verdict {
  quality: Quality
  lossCp: number
  bestMove: Uci
  bestSan: string
  /** Both scores from the player's perspective. */
  bestScore: Score
  moveScore: Score
}

export interface BookMove {
  uci: Uci
  san: string
}

export interface Proof extends ProofEvaluation {
  /** The player's move followed by the refutation, as far as it is known. */
  line: Uci[]
  /** Latest evaluation of the line, from the player's perspective. */
  evaluation: Score
  /** Number of proof moves on the board (1 = just the player's move). */
  cursor: number
  playing: boolean
  /** Whether playback has reached the stopping point, so the verdict can be shown. */
  reachedEnd: boolean
}

export interface Review {
  /** Position before the player's move. */
  preFen: string
  move: PlayedMove
  /** Drill only: the book moves the player should have chosen, when the move left the book. */
  bookMoves: BookMove[] | null
  verdict: Verdict | null
  proof: Proof | null
}

export interface GameState {
  /** Incremented on every new game so stale async work can tell it is stale. */
  id: number
  mode: Mode
  player: Color
  startFen: string
  moves: PlayedMove[]
  phase: Phase
  finish: Finish | null
  review: Review | null
  /** The verdict on the player's most recent judged move. */
  lastVerdict: Verdict | null
}

const initialState: GameState = {
  id: 0,
  mode: 'drill',
  player: 'w',
  startFen: START_FEN,
  moves: [],
  phase: 'setup',
  finish: null,
  review: null,
  lastVerdict: null,
}

export const currentFenOf = (game: GameState): string => game.moves.at(-1)?.fen ?? game.startFen

/** After a move is final: end the game if it is over, otherwise hand the turn over. */
function passTurn(game: GameState) {
  const outcome = gameOutcome([game.startFen, ...game.moves.map((m) => m.fen)])
  if (outcome) {
    game.phase = 'finished'
    game.finish = { kind: 'outcome', outcome }
  } else {
    game.phase = sideToMove(currentFenOf(game)) === game.player ? 'player' : 'opponent'
  }
}

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    gameStarted(state, action: PayloadAction<{ mode: Mode; player: Color }>) {
      Object.assign(state, initialState, {
        id: state.id + 1,
        mode: action.payload.mode,
        player: action.payload.player,
      })
      passTurn(state)
    },
    gameCleared(state, action: PayloadAction<Mode>) {
      Object.assign(state, initialState, { id: state.id + 1, mode: action.payload })
    },
    playerMoved(state, action: PayloadAction<{ move: PlayedMove; judge: boolean; bookMoves: BookMove[] | null }>) {
      const { move, judge, bookMoves } = action.payload
      const preFen = currentFenOf(state)
      state.moves.push(move)
      if (judge) {
        state.phase = 'judging'
        state.review = { preFen, move, bookMoves, verdict: null, proof: null }
      } else {
        passTurn(state)
      }
    },
    moveJudged(state, action: PayloadAction<{ verdict: Verdict | null; proof: Proof | null }>) {
      if (state.phase !== 'judging' || !state.review) return
      const { verdict, proof } = action.payload
      state.lastVerdict = verdict
      state.review.verdict = verdict
      state.review.proof = proof
      if (state.review.bookMoves || proof) {
        state.phase = 'review'
      } else {
        state.review = null
        passTurn(state)
      }
    },
    opponentMoved(state, action: PayloadAction<PlayedMove>) {
      if (state.phase !== 'opponent') return
      state.moves.push(action.payload)
      passTurn(state)
    },
    lineCompleted(state) {
      state.phase = 'finished'
      state.finish = { kind: 'lineComplete' }
    },
    /** Undo the move under review and let the player try again. */
    tookBack(state) {
      if (!state.review) return
      state.moves.pop()
      state.review = null
      state.phase = 'player'
    },
    /** Accept the move under review and carry on with the game. */
    moveKept(state) {
      if (!state.review) return
      state.review = null
      passTurn(state)
    },

    proofTicked(state) {
      const proof = state.review?.proof
      if (!proof?.playing) return
      if (proof.cursor < proof.moves.length) proof.cursor++
      settleAtEnd(proof)
    },
    proofStepped(state, action: PayloadAction<number>) {
      const proof = state.review?.proof
      if (!proof) return
      proof.playing = false
      proof.cursor = Math.max(1, Math.min(proof.moves.length, proof.cursor + action.payload))
      settleAtEnd(proof)
    },
    proofReplayed(state) {
      const proof = state.review?.proof
      if (!proof) return
      proof.cursor = 1
      proof.playing = true
    },
    proofPaused(state) {
      const proof = state.review?.proof
      if (proof) proof.playing = false
    },
    proofExtended(state, action: PayloadAction<{ line: Uci[]; evaluation: Score; moves: PlayedMove[]; status: ProofStatus }>) {
      const proof = state.review?.proof
      if (!proof) return
      Object.assign(proof, action.payload)
      settleAtEnd(proof)
    },
  },
})

export function isProofAtEnd(proof: Proof): boolean {
  return proof.status.kind === 'stopped' && proof.cursor >= proof.status.at
}

function settleAtEnd(proof: Proof) {
  if (!isProofAtEnd(proof)) return
  proof.playing = false
  proof.reachedEnd = true
}

export const {
  gameStarted,
  gameCleared,
  playerMoved,
  moveJudged,
  opponentMoved,
  lineCompleted,
  tookBack,
  moveKept,
  proofTicked,
  proofStepped,
  proofReplayed,
  proofPaused,
  proofExtended,
} = gameSlice.actions
