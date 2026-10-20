import { Chess, type Color, type Move, type Square } from 'chess.js'

export type { Color, Square }

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** A move in UCI long algebraic form, e.g. "e2e4" or "e7e8q". */
export type Uci = string

/**
 * The identity of a position for caching and book lookup: board, side to move, castling
 * rights and en-passant square, without the halfmove and fullmove counters.
 */
export type FenKey = string

export function fenKey(fen: string): FenKey {
  return fen.split(' ').slice(0, 4).join(' ')
}

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

export function uciOf(move: Pick<Move, 'from' | 'to' | 'promotion'>): Uci {
  return move.from + move.to + (move.promotion ?? '')
}

export function parseUci(uci: Uci): { from: Square; to: Square; promotion?: string } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  }
}

export interface PlayedMove {
  uci: Uci
  san: string
  /** Position after the move. */
  fen: string
}

/** Plays a UCI move from a position; null if it is illegal there. */
export function playUci(fen: string, uci: Uci): PlayedMove | null {
  const chess = new Chess(fen)
  try {
    const move = chess.move(parseUci(uci))
    return { uci: uciOf(move), san: move.san, fen: chess.fen() }
  } catch {
    return null
  }
}

export function legalMoves(fen: string): Move[] {
  return new Chess(fen).moves({ verbose: true })
}

export function legalUcis(fen: string): Uci[] {
  return legalMoves(fen).map(uciOf)
}

/** Fullmove number and side to move, for numbering moves in a list. */
export function moveNumberOf(fen: string): { number: number; color: Color } {
  const parts = fen.split(' ')
  return { number: Number(parts[5] ?? 1), color: parts[1] === 'b' ? 'b' : 'w' }
}
