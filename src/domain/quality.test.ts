import { describe, expect, it } from 'vitest'
import type { PositionAnalysis } from './analysis'
import { classify, destinationQualities, judgeMove, type QualityThresholds } from './quality'
import { cp, formatScore, mate, scoreValue } from './score'

const t: QualityThresholds = { greenMaxLoss: 30, yellowMaxLoss: 100, orangeMaxLoss: 200, evalCapCp: 1000 }

describe('scoreValue', () => {
  it('orders mates around centipawns', () => {
    expect(scoreValue(mate(1))).toBeGreaterThan(scoreValue(mate(5)))
    expect(scoreValue(mate(5))).toBeGreaterThan(scoreValue(cp(5000)))
    expect(scoreValue(mate(-5))).toBeLessThan(scoreValue(cp(-5000)))
    expect(scoreValue(mate(-5))).toBeGreaterThan(scoreValue(mate(-1)))
    expect(scoreValue(mate(0))).toBe(-10000)
  })

  it('formats scores for display', () => {
    expect(formatScore(cp(45))).toBe('+0.45')
    expect(formatScore(cp(-120))).toBe('−1.20')
    expect(formatScore(mate(3))).toBe('M3')
    expect(formatScore(mate(-2))).toBe('−M2')
  })
})

describe('classify', () => {
  it('uses the loss thresholds', () => {
    expect(classify(cp(50), cp(20), t)).toBe('green')
    expect(classify(cp(50), cp(19), t)).toBe('yellow')
    expect(classify(cp(50), cp(-50), t)).toBe('yellow')
    expect(classify(cp(50), cp(-150), t)).toBe('orange')
    expect(classify(cp(50), cp(-151), t)).toBe('red')
  })

  it('is red when the move allows a forced mate', () => {
    expect(classify(cp(-150), mate(-4), t)).toBe('red')
  })

  it('does not punish moves when every move gets mated', () => {
    expect(classify(mate(-5), mate(-3), t)).toBe('green')
  })

  it('treats keeping a decisive advantage as fine', () => {
    expect(classify(mate(3), cp(1500), t)).toBe('green')
    expect(classify(cp(1800), cp(1050), t)).toBe('green')
    expect(classify(mate(3), cp(300), t)).toBe('red')
  })
})

const analysis: PositionAnalysis = {
  fenKey: 'x',
  depth: 12,
  complete: true,
  lines: {
    e7e8q: { move: 'e7e8q', depth: 12, score: cp(900), pv: ['e7e8q'] },
    e7e8n: { move: 'e7e8n', depth: 12, score: cp(200), pv: ['e7e8n'] },
    e7d8q: { move: 'e7d8q', depth: 12, score: cp(-500), pv: ['e7d8q'] },
    e7d8n: { move: 'e7d8n', depth: 12, score: cp(870), pv: ['e7d8n'] },
    g1f3: { move: 'g1f3', depth: 12, score: cp(0), pv: ['g1f3'] },
  },
}

describe('destinationQualities', () => {
  it('colors each destination by its best promotion', () => {
    expect(destinationQualities(analysis, 'e7', t)).toEqual({ e8: 'green', d8: 'green' })
    expect(destinationQualities(analysis, 'g1', t)).toEqual({ f3: 'red' })
  })
})

describe('judgeMove', () => {
  it('reports loss against the best line', () => {
    const verdict = judgeMove(analysis, 'e7e8n', t)
    expect(verdict?.best.move).toBe('e7e8q')
    expect(verdict?.loss).toBe(700)
    expect(verdict?.quality).toBe('red')
  })
})
