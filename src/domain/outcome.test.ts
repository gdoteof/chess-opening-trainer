import { describe, expect, it } from 'vitest'
import { playUci, START_FEN } from './chess'
import { materialBalance } from './material'
import { gameOutcome } from './outcome'

function fensAfter(...ucis: string[]): string[] {
  const fens = [START_FEN]
  for (const uci of ucis) fens.push(playUci(fens[fens.length - 1], uci)!.fen)
  return fens
}

describe('gameOutcome', () => {
  it('detects checkmate', () => {
    expect(gameOutcome(fensAfter('f2f3', 'e7e5', 'g2g4', 'd8h4'))).toEqual({ kind: 'checkmate', winner: 'b' })
  })

  it('detects threefold repetition across the game', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
    expect(gameOutcome(fensAfter(...shuffle, ...shuffle))).toEqual({ kind: 'draw', reason: 'threefold repetition' })
    expect(gameOutcome(fensAfter(...shuffle))).toBeNull()
  })

  it('detects stalemate', () => {
    expect(gameOutcome(['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'])).toEqual({ kind: 'draw', reason: 'stalemate' })
  })
})

describe('materialBalance', () => {
  it('counts from the given side', () => {
    expect(materialBalance(START_FEN, 'w')).toBe(0)
    expect(materialBalance('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'b')).toBe(-900)
  })
})
