import { describe, expect, it } from 'vitest'
import type { PositionAnalysis } from './analysis'
import { chooseBotMove, temperatureForRating } from './bot'
import { cp, mate } from './score'

const analysis: PositionAnalysis = {
  fenKey: 'x',
  depth: 18,
  complete: true,
  lines: {
    a: { move: 'a', depth: 18, score: cp(40), pv: ['a'] },
    b: { move: 'b', depth: 18, score: cp(10), pv: ['b'] },
    c: { move: 'c', depth: 18, score: cp(-300), pv: ['c'] },
    d: { move: 'd', depth: 18, score: mate(-2), pv: ['d'] },
  },
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function frequencies(rating: number) {
  const random = seeded(7)
  const counts: Record<string, number> = {}
  for (let i = 0; i < 4000; i++) {
    const move = chooseBotMove(analysis, { kind: 'rating', rating }, 1000, random)!
    counts[move] = (counts[move] ?? 0) + 1
  }
  return counts
}

describe('temperatureForRating', () => {
  it('falls as rating rises', () => {
    expect(temperatureForRating(400)).toBeCloseTo(250)
    expect(temperatureForRating(2800)).toBeCloseTo(8)
    expect(temperatureForRating(1200)).toBeGreaterThan(temperatureForRating(2000))
  })
})

describe('chooseBotMove', () => {
  it('plays the best move at max strength', () => {
    expect(chooseBotMove(analysis, { kind: 'max' }, 1000)).toBe('a')
  })

  it('blunders often when weak and rarely when strong', () => {
    const weak = frequencies(400)
    const strong = frequencies(2600)
    expect(weak.c).toBeGreaterThan(300)
    expect(strong.c ?? 0).toBe(0)
    expect(strong.a).toBeGreaterThan(strong.b)
  })
})
