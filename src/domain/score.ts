import { config } from '../config'

/**
 * An engine score from the perspective of the side to move: centipawns, or moves to mate
 * (positive when the side to move mates, zero or negative when it is mated).
 */
export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number }

export const cp = (value: number): Score => ({ kind: 'cp', value })
export const mate = (value: number): Score => ({ kind: 'mate', value })

/** Mate scores become ±(scoreBase − moves to mate), so they order correctly with centipawns. */
export function scoreValue(score: Score, mateBase = config.mate.scoreBase): number {
  if (score.kind === 'cp') return score.value
  if (score.value > 0) return mateBase - score.value
  return -mateBase - score.value
}

/** True when the side to move is being mated. */
export function isMatedScore(score: Score): boolean {
  return score.kind === 'mate' && score.value <= 0
}

export function negate(score: Score): Score {
  return { kind: score.kind, value: -score.value }
}

/** Clamped value used for comparing moves; see `config.quality.evalCapCp`. */
export function cappedValue(score: Score, cap: number): number {
  if (score.kind === 'mate') return score.value > 0 ? cap : -cap
  return Math.max(-cap, Math.min(cap, score.value))
}

/** "+0.45", "−1.20", "M3", "−M2" (mated in two). */
export function formatScore(score: Score): string {
  if (score.kind === 'mate') {
    if (score.value === 0) return '#'
    return score.value > 0 ? `M${score.value}` : `−M${-score.value}`
  }
  const pawns = (score.value / 100).toFixed(2)
  if (score.value > 0) return `+${pawns}`
  if (score.value < 0) return `−${pawns.slice(1)}`
  return '0.00'
}
