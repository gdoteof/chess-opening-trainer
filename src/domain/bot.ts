import { bestLine, type PositionAnalysis } from './analysis'
import type { Uci } from './chess'
import { moveLoss } from './quality'

export type BotStrength = { kind: 'rating'; rating: number } | { kind: 'max' }

/**
 * Sampling temperature (in centipawns) for a rating: higher means more willing to play
 * moves that lose material. Starts as a straight exponential from 250 at 400 to 8 at
 * 2800; meant to be tuned by feel against people of known strength.
 */
export function temperatureForRating(rating: number): number {
  const [lowRating, highRating] = [400, 2800]
  const [lowT, highT] = [250, 8]
  const t = Math.min(1, Math.max(0, (rating - lowRating) / (highRating - lowRating)))
  return lowT * Math.pow(highT / lowT, t)
}

export type Random = () => number

/**
 * The bot's move from a full-strength all-moves analysis. "max" always plays the best move;
 * a rating samples every legal move with probability ∝ exp(−loss / T).
 */
export function chooseBotMove(
  analysis: PositionAnalysis,
  strength: BotStrength,
  evalCapCp: number,
  random: Random = Math.random,
): Uci | null {
  const best = bestLine(analysis)
  if (!best) return null
  if (strength.kind === 'max') return best.move

  const temperature = temperatureForRating(strength.rating)
  const lines = Object.values(analysis.lines)
  const weights = lines.map((line) => Math.exp(-moveLoss(best.score, line.score, evalCapCp) / temperature))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let pick = random() * total
  for (let i = 0; i < lines.length; i++) {
    pick -= weights[i]
    if (pick < 0) return lines[i].move
  }
  return best.move
}
