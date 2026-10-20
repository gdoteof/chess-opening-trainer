import { describe, expect, it } from 'vitest'
import { evaluateProof, type ProofRules } from './proof'
import { cp, mate } from './score'

const rules: ProofRules = { maxPlies: 12, materialDropCp: 200, roughlyEvenCp: 100 }

describe('evaluateProof', () => {
  it('stops at checkmate on the board', () => {
    // 1. f3 e5 2. g4?? Qh4#
    const result = evaluateProof(
      {
        baseFen: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        line: ['g2g4', 'd8h4'],
        player: 'w',
        evaluation: mate(-1),
      },
      rules,
    )
    expect(result.status).toEqual({ kind: 'stopped', at: 2, outcome: { kind: 'checkmate', onBoard: true, mateIn: null } })
    expect(result.moves.map((m) => m.san)).toEqual(['g4', 'Qh4#'])
  })

  it('stops once a material loss cannot be won back', () => {
    // 3. Ng5 Be7 4. Nxf7? Kxf7: a knight for a pawn, and 5. d3 does not win it back.
    const result = evaluateProof(
      {
        baseFen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        line: ['f3g5', 'f8e7', 'g5f7', 'e8f7', 'd2d3', 'h8f8'],
        player: 'w',
        evaluation: cp(-250),
      },
      rules,
    )
    expect(result.status).toMatchObject({ kind: 'stopped', at: 4, outcome: { kind: 'material', lossCp: 200 } })
  })

  it('does not stop on a capture that is immediately recaptured', () => {
    // Black plays 2...Nc6 3. Bb5 a6 4. Bxc6 dxc6: the knight is lost but won straight back.
    const result = evaluateProof(
      {
        baseFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
        line: ['b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6'],
        player: 'b',
        evaluation: cp(-30),
      },
      rules,
    )
    expect(result.status).toEqual({ kind: 'needsMore', fromFen: result.moves[4].fen })
  })

  it('asks for more when the line runs out before a stopping point', () => {
    const result = evaluateProof(
      {
        baseFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        line: ['g2g4', 'e7e5'],
        player: 'w',
        evaluation: cp(-90),
      },
      rules,
    )
    expect(result.status.kind).toBe('needsMore')
  })

  it('reports a positional disadvantage at the ply limit when material is even', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
    const result = evaluateProof(
      {
        baseFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        line: ['b1c3', 'b8c6', 'c3b1', 'c6b8', ...shuffle, 'g1h3', 'g8h6', 'h3g1', 'h6g8', 'b1a3'],
        player: 'w',
        evaluation: cp(-120),
      },
      rules,
    )
    expect(result.status).toEqual({
      kind: 'stopped',
      at: 13,
      outcome: { kind: 'positional', evaluation: cp(-120) },
    })
  })

  it('plays through material swings when a mate is announced', () => {
    const result = evaluateProof(
      {
        baseFen: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        line: ['g2g4'],
        player: 'w',
        evaluation: mate(-1),
      },
      rules,
    )
    expect(result.status.kind).toBe('needsMore')
  })
})
