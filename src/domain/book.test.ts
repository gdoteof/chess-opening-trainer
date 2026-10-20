import { describe, expect, it } from 'vitest'
import { buildBook, openingTree, namesAlong, openingAt, openingsThrough, parseOpeningsTsv, rankForGame } from './book'
import { fenKey, playUci, START_FEN } from './chess'

const tsv = [
  'eco\tname\tpgn',
  'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
  'C55\tItalian Game: Two Knights Defense\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6',
  'C50\tItalian Game: Giuoco Piano\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  'C44\tKing\'s Pawn Game\t1. e4 e5 2. Nf3',
  'C60\tRuy Lopez\t1. e4 e5 2. Nf3 Nc6 3. Bb5',
  'A40\tQueen\'s Pawn Game\t1. d4',
  'A45\tIndian Defense\t1. d4 Nf6',
  'A50\tIndian Game: transposed\t1. Nf3 Nf6 2. d4',
  'B20\tSicilian Defense\t1. e4 c5',
  'A02\tBird Opening\t1. f4',
  'A02\tBird Opening: Sicilian Transposition\t1. e4 c5 2. f4',
].join('\n')

const book = buildBook(parseOpeningsTsv(tsv))

function fensAfter(...ucis: string[]): string[] {
  const fens = [START_FEN]
  for (const uci of ucis) fens.push(playUci(fens[fens.length - 1], uci)!.fen)
  return fens
}

describe('parseOpeningsTsv', () => {
  it('strips move numbers from the pgn column', () => {
    expect(parseOpeningsTsv(tsv)[0]).toEqual({ eco: 'C50', name: 'Italian Game', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] })
  })
})

describe('buildBook', () => {
  it('lists every book move from a position', () => {
    const afterNc6 = fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6').at(-1)!
    expect(book.positions.get(fenKey(afterNc6))?.moves.sort()).toEqual(['f1b5', 'f1c4'])
  })

  it('merges transpositions by position', () => {
    const viaD4 = fensAfter('d2d4', 'g8f6', 'g1f3').at(-1)!
    const viaNf3 = fensAfter('g1f3', 'g8f6', 'd2d4').at(-1)!
    expect(fenKey(viaD4)).toBe(fenKey(viaNf3))
    expect(book.positions.get(fenKey(viaD4))?.name).toBe('Indian Game: transposed')
  })

  it('lists distinct names with the size of their tree', () => {
    const italian = book.openings.find((o) => o.name === 'Italian Game')
    expect(italian).toEqual({ name: 'Italian Game', eco: 'C50', lineCount: 3, side: 'w' })
    expect(book.openings.map((o) => o.name)).toEqual([...book.openings.map((o) => o.name)].sort())
  })

  it('gives each opening to the side whose move names it', () => {
    const sideOf = (name: string) => book.openings.find((o) => o.name === name)?.side
    expect(sideOf('Italian Game')).toBe('w')
    expect(sideOf('Italian Game: Two Knights Defense')).toBe('b')
    expect(sideOf('Sicilian Defense')).toBe('b')
    expect(sideOf('Bird Opening')).toBe('w')
  })

  it('lets a Defense or an Attack in the name decide', () => {
    const named = buildBook(
      parseOpeningsTsv(
        [
          'eco\tname\tpgn',
          "E61\tKing's Indian Defense\t1. d4 Nf6 2. c4 g6 3. Nc3",
          'B75\tSicilian Defense: Dragon Variation, Yugoslav Attack\t1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O',
          'C89\tRuy Lopez: Marshall Attack\t1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5',
          'A00\tHungarian Opening: Reversed Norwegian Defense\t1. g3 e5 2. Nf3 e4 3. Nh4',
        ].join('\n'),
      ),
    )
    const sideOf = (name: string) => named.openings.find((o) => o.name === name)?.side
    expect(sideOf("King's Indian Defense")).toBe('b')
    expect(sideOf('Sicilian Defense: Dragon Variation, Yugoslav Attack')).toBe('w')
    expect(sideOf('Ruy Lopez: Marshall Attack')).toBe('b')
    expect(sideOf('Hungarian Opening: Reversed Norwegian Defense')).toBe('w')
  })
})

describe('openingTree', () => {
  it('includes the chosen line and its sub-variations only', () => {
    const tree = openingTree(book, 'Italian Game')
    const afterBc4 = fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4').at(-1)!
    const afterNc6 = fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6').at(-1)!
    expect(tree.moves.get(fenKey(afterBc4))?.sort()).toEqual(['f8c5', 'g8f6'])
    expect(tree.moves.get(fenKey(afterNc6))).toEqual(['f1c4'])
    expect(tree.moves.get(fenKey(START_FEN))).toEqual(['e2e4'])
    expect(tree.lineIds.map((id) => book.lines[id].name)).toEqual([
      'Italian Game',
      'Italian Game: Giuoco Piano',
      'Italian Game: Two Knights Defense',
    ])
    expect(tree.endingAt.get(fenKey(afterBc4))?.map((id) => book.lines[id].name)).toEqual(['Italian Game'])
  })
})

describe('openingAt', () => {
  it('names the position by the most recent named position', () => {
    const fens = fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')
    expect(openingAt(book, fens)).toEqual({ name: "King's Pawn Game", eco: 'C44', inBook: true })
  })

  it('keeps the last name once out of book', () => {
    const fens = fensAfter('d2d4', 'g8f6', 'c2c4')
    expect(openingAt(book, fens)).toEqual({ name: 'Indian Defense', eco: 'A45', inBook: false })
  })
})

describe('openingsThrough', () => {
  const names = (...ucis: string[]) => openingsThrough(book, fensAfter(...ucis)).map((o) => o.name)

  it('keeps openings with a line through the position', () => {
    expect(names('e2e4', 'e7e5', 'g1f3', 'b8c6')).toEqual([
      'Italian Game',
      'Italian Game: Giuoco Piano',
      'Italian Game: Two Knights Defense',
      'Ruy Lopez',
    ])
  })

  it('keeps a family named along the way when its sub-variations go on', () => {
    expect(names('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6')).toEqual([
      'Italian Game',
      'Italian Game: Two Knights Defense',
    ])
  })

  it('leaves out a family that only a stray sub-variation connects', () => {
    expect(names('e2e4', 'c7c5')).toEqual(['Bird Opening: Sicilian Transposition', 'Sicilian Defense'])
  })

  it('finds openings reached by another move order', () => {
    expect(names('d2d4', 'g8f6', 'g1f3')).toEqual(['Indian Game: transposed'])
  })

  it('keeps everything at the starting position', () => {
    expect(openingsThrough(book, [START_FEN])).toHaveLength(book.openings.length)
  })
})

describe('namesAlong', () => {
  it('lists named positions along a game, deepest first', () => {
    expect(namesAlong(book, fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'))).toEqual([
      'Italian Game',
      "King's Pawn Game",
    ])
  })
})

describe('rankForGame', () => {
  it('puts names along the game first, then the biggest trees', () => {
    const fens = fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4')
    const ranked = rankForGame(book, fens, openingsThrough(book, fensAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')))
    expect(ranked.map((o) => o.name)).toEqual([
      'Italian Game',
      'Italian Game: Giuoco Piano',
      'Italian Game: Two Knights Defense',
      'Ruy Lopez',
    ])
    const afterC5 = fensAfter('e2e4', 'c7c5')
    expect(rankForGame(book, afterC5, openingsThrough(book, afterC5)).map((o) => o.name)).toEqual([
      'Sicilian Defense',
      'Bird Opening: Sicilian Transposition',
    ])
  })
})
