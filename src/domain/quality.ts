import { bestLine, type MoveLine, type PositionAnalysis } from './analysis'
import type { Uci } from './chess'
import { cappedValue, isMatedScore, type Score } from './score'

export type Quality = 'green' | 'yellow' | 'orange' | 'red'

export interface QualityThresholds {
  greenMaxLoss: number
  yellowMaxLoss: number
  orangeMaxLoss: number
  evalCapCp: number
}

export const QUALITY_LABEL: Record<Quality, string> = {
  green: 'Good move',
  yellow: 'Inaccuracy',
  orange: 'Mistake',
  red: 'Blunder',
}

export function isBadQuality(quality: Quality): boolean {
  return quality === 'orange' || quality === 'red'
}

/** Centipawns given up by playing `move` instead of `best`, after clamping both. */
export function moveLoss(best: Score, move: Score, cap: number): number {
  return Math.max(0, cappedValue(best, cap) - cappedValue(move, cap))
}

export function classify(best: Score, move: Score, t: QualityThresholds): Quality {
  if (isMatedScore(move) && !isMatedScore(best)) return 'red'
  const loss = moveLoss(best, move, t.evalCapCp)
  if (loss <= t.greenMaxLoss) return 'green'
  if (loss <= t.yellowMaxLoss) return 'yellow'
  if (loss <= t.orangeMaxLoss) return 'orange'
  return 'red'
}

export interface MoveVerdict {
  move: Uci
  quality: Quality
  loss: number
  line: MoveLine
  best: MoveLine
}

export function judgeMove(
  analysis: PositionAnalysis,
  move: Uci,
  t: QualityThresholds,
): MoveVerdict | null {
  const line = analysis.lines[move]
  const best = bestLine(analysis)
  if (!line || !best) return null
  return {
    move,
    quality: classify(best.score, line.score, t),
    loss: moveLoss(best.score, line.score, t.evalCapCp),
    line,
    best,
  }
}

const RANK: Record<Quality, number> = { green: 0, yellow: 1, orange: 2, red: 3 }

/**
 * Quality of each destination square for the piece on `from`. When several moves land on
 * the same square (promotions), the square shows the best of them.
 */
export function destinationQualities(
  analysis: PositionAnalysis,
  from: string,
  t: QualityThresholds,
): Record<string, Quality> {
  const best = bestLine(analysis)
  const result: Record<string, Quality> = {}
  if (!best) return result
  for (const line of Object.values(analysis.lines)) {
    if (line.move.slice(0, 2) !== from) continue
    const to = line.move.slice(2, 4)
    const quality = classify(best.score, line.score, t)
    const current = result[to]
    if (current === undefined || RANK[quality] < RANK[current]) result[to] = quality
  }
  return result
}
