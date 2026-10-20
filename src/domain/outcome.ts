import { Chess } from 'chess.js'
import { fenKey, type Color } from './chess'

export type DrawReason = 'stalemate' | 'threefold repetition' | 'fifty-move rule' | 'insufficient material'

export type GameOutcome =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }

/**
 * How the game stands after the last of `fens` (every position from the start, in order),
 * or null if it is still going.
 */
export function gameOutcome(fens: readonly string[]): GameOutcome | null {
  const current = fens[fens.length - 1]
  const chess = new Chess(current)
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { kind: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient material' }
  const key = fenKey(current)
  if (fens.filter((fen) => fenKey(fen) === key).length >= 3) {
    return { kind: 'draw', reason: 'threefold repetition' }
  }
  if (Number(current.split(' ')[4]) >= 100) return { kind: 'draw', reason: 'fifty-move rule' }
  return null
}

export function describeOutcome(outcome: GameOutcome, player: Color): string {
  if (outcome.kind === 'checkmate') {
    return outcome.winner === player ? 'Checkmate — you win' : 'Checkmate — you lose'
  }
  return `Draw by ${outcome.reason}`
}
