import { describe, expect, it } from 'vitest'
import { buildBook, openingTree, parseOpeningsTsv } from './book'
import { playUci, START_FEN } from './chess'
import { bookMoveOptions, chooseBookReply, linesEndingAt } from './practice'

const book = buildBook(
  parseOpeningsTsv(
    [
      'eco\tname\tpgn',
      'C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4',
      'C50\tItalian Game: Giuoco Piano\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
      'C55\tItalian Game: Two Knights Defense\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6',
      'C57\tItalian Game: Two Knights Defense, Fried Liver Attack\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7',
    ].join('\n'),
  ),
)
const tree = openingTree(book, 'Italian Game')
const id = (name: string) => book.lines.findIndex((l) => l.name === name)
const afterBc4 = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'].reduce((fen, uci) => playUci(fen, uci)!.fen, START_FEN)

describe('drill coverage', () => {
  it('knows which lines end where', () => {
    expect(linesEndingAt(tree, afterBc4)).toEqual([id('Italian Game')])
    expect(linesEndingAt(tree, START_FEN)).toEqual([])
  })

  it('counts the unplayed lines each book move leads toward', () => {
    expect(bookMoveOptions(book, tree, afterBc4, new Set())).toEqual([
      { uci: 'f8c5', unplayed: 1 },
      { uci: 'g8f6', unplayed: 2 },
    ])
    const played = new Set([id('Italian Game: Two Knights Defense')])
    expect(bookMoveOptions(book, tree, afterBc4, played)[1]).toEqual({ uci: 'g8f6', unplayed: 1 })
  })

  it('steers the book reply toward unplayed lines', () => {
    const played = new Set([id('Italian Game: Giuoco Piano')])
    for (const r of [0, 0.5, 0.99]) expect(chooseBookReply(book, tree, afterBc4, played, () => r)).toBe('g8f6')
  })

  it('replies at random once every line through the position is played', () => {
    const played = new Set(tree.lineIds)
    expect(chooseBookReply(book, tree, afterBc4, played, () => 0)).toBe('f8c5')
    expect(chooseBookReply(book, tree, afterBc4, played, () => 0.99)).toBe('g8f6')
  })
})
