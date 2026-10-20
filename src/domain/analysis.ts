import type { FenKey, Uci } from './chess'
import { scoreValue, type Score } from './score'

/** The engine's verdict on one legal move. */
export interface MoveLine {
  move: Uci
  depth: number
  score: Score
  /** Principal variation, starting with `move`. */
  pv: Uci[]
}

/** An all-moves (MultiPV) analysis of one position. */
export interface PositionAnalysis {
  fenKey: FenKey
  /** Depth reached by every line. */
  depth: number
  lines: Record<Uci, MoveLine>
  /** True when the search ended on its own (target depth or time budget), not by cancellation. */
  complete: boolean
}

export function bestLine(analysis: PositionAnalysis): MoveLine | undefined {
  let best: MoveLine | undefined
  for (const line of Object.values(analysis.lines)) {
    if (!best || compareLines(line, best) < 0) best = line
  }
  return best
}

function compareLines(a: MoveLine, b: MoveLine): number {
  return scoreValue(b.score) - scoreValue(a.score)
}
