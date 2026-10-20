import type { Color } from './chess'

const PIECE_VALUE: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 }

/** Material of `color` minus material of the opponent, in centipawns. */
export function materialBalance(fen: string, color: Color): number {
  let balance = 0
  for (const ch of fen.split(' ')[0]) {
    const value = PIECE_VALUE[ch.toLowerCase()]
    if (value === undefined) continue
    const pieceColor: Color = ch === ch.toUpperCase() ? 'w' : 'b'
    balance += pieceColor === color ? value : -value
  }
  return balance
}
