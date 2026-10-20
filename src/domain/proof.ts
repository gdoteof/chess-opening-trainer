import { Chess } from 'chess.js'
import { parseUci, uciOf, type Color, type PlayedMove, type Uci } from './chess'
import { materialBalance } from './material'
import { formatScore, isMatedScore, type Score } from './score'

/**
 * A blunder proof replays the engine's line after the player's bad move until the damage is
 * visible on the board.
 */

export type ProofOutcome =
  | { kind: 'checkmate'; onBoard: boolean; mateIn: number | null }
  | { kind: 'material'; lossCp: number }
  | { kind: 'positional'; evaluation: Score }
  | { kind: 'draw' }

export interface ProofRules {
  maxPlies: number
  materialDropCp: number
  roughlyEvenCp: number
}

export interface ProofInput {
  /** Position before the player's move. */
  baseFen: string
  /** The player's move followed by the engine's refutation. */
  line: Uci[]
  player: Color
  /** Latest evaluation of the line, from the player's perspective. */
  evaluation: Score
}

export type ProofStatus =
  /** Stop with `moves[at - 1]` as the last move shown. */
  | { kind: 'stopped'; at: number; outcome: ProofOutcome }
  /** The line ran out before a stopping point; continue it from `fromFen`. */
  | { kind: 'needsMore'; fromFen: string }

export interface ProofEvaluation {
  /** The line as played, cut at the first illegal move. */
  moves: PlayedMove[]
  status: ProofStatus
}

export function evaluateProof(input: ProofInput, rules: ProofRules): ProofEvaluation {
  const chess = new Chess(input.baseFen)
  const moves: PlayedMove[] = []
  for (const uci of input.line) {
    try {
      const move = chess.move(parseUci(uci))
      moves.push({ uci: uciOf(move), san: move.san, fen: chess.fen() })
    } catch {
      break
    }
  }

  const fens = [input.baseFen, ...moves.map((m) => m.fen)]
  const before = materialBalance(input.baseFen, input.player)
  const drop = (i: number) => before - materialBalance(fens[i], input.player)
  const mateAgainst = isMatedScore(input.evaluation) && input.evaluation.value < 0
  const mateIn = mateAgainst ? -input.evaluation.value : null

  const stopped = (at: number, outcome: ProofOutcome): ProofEvaluation => ({
    moves: moves.slice(0, at),
    status: { kind: 'stopped', at, outcome },
  })

  for (let i = 1; i < fens.length; i++) {
    const position = new Chess(fens[i])
    if (position.isCheckmate()) return stopped(i, { kind: 'checkmate', onBoard: true, mateIn: null })
    if (position.isDraw()) return stopped(i, { kind: 'draw' })

    const refutationPlies = i - 1
    const atLimit = refutationPlies >= rules.maxPlies

    // A material drop only counts once the player's next move fails to win it back.
    if (!mateAgainst && drop(i) >= rules.materialDropCp) {
      if (i + 1 < fens.length) {
        if (drop(i + 1) >= rules.materialDropCp) {
          return stopped(i, { kind: 'material', lossCp: Math.min(drop(i), drop(i + 1)) })
        }
      } else if (!atLimit) {
        return { moves, status: { kind: 'needsMore', fromFen: fens[i] } }
      }
    }

    if (atLimit) {
      if (mateAgainst) return stopped(i, { kind: 'checkmate', onBoard: false, mateIn })
      if (drop(i) >= rules.roughlyEvenCp) return stopped(i, { kind: 'material', lossCp: drop(i) })
      return stopped(i, { kind: 'positional', evaluation: input.evaluation })
    }
  }
  return { moves, status: { kind: 'needsMore', fromFen: fens[fens.length - 1] } }
}

export function describeProofOutcome(outcome: ProofOutcome): { title: string; detail: string } {
  switch (outcome.kind) {
    case 'checkmate':
      return {
        title: 'Checkmate',
        detail: outcome.onBoard
          ? 'This move lets your opponent checkmate you.'
          : `Your opponent has a forced mate${outcome.mateIn ? ` in ${outcome.mateIn}` : ''}.`,
      }
    case 'material': {
      const pawns = Math.max(1, Math.round(outcome.lossCp / 100))
      return {
        title: `Loses material (−${pawns})`,
        detail: `You end up ${pawns} pawn${pawns === 1 ? '' : 's'} worth of material down.`,
      }
    }
    case 'positional':
      return {
        title: `Positional disadvantage (eval ${formatScore(outcome.evaluation)})`,
        detail: 'Material stays roughly even, but your position gets worse.',
      }
    case 'draw':
      return { title: 'Allows a draw', detail: 'This move lets the game end in a draw.' }
  }
}
