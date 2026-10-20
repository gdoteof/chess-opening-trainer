import type { Book, OpeningTree } from './book'
import type { Random } from './bot'
import { fenKey, playUci, type FenKey, type Uci } from './chess'

/**
 * A drill works through every line of an opening's tree. A line counts as played once the
 * drill reaches the position where it ends, whatever the move order.
 */

/** Lines of the tree that end at this position. */
export function linesEndingAt(tree: OpeningTree, fen: string): number[] {
  return tree.endingAt.get(fenKey(fen)) ?? []
}

function unplayedThrough(book: Book, tree: OpeningTree, key: FenKey, played: ReadonlySet<number>): number {
  return tree.lineIds.filter((id) => !played.has(id) && book.lines[id].fenKeys.includes(key)).length
}

export interface BookMoveOption {
  uci: Uci
  /** Unplayed lines that this move keeps open. */
  unplayed: number
}

/** The book moves from a position, with how many unplayed lines each one leads toward. */
export function bookMoveOptions(
  book: Book,
  tree: OpeningTree,
  fen: string,
  played: ReadonlySet<number>,
): BookMoveOption[] {
  return (tree.moves.get(fenKey(fen)) ?? []).map((uci) => {
    const after = playUci(fen, uci)
    return { uci, unplayed: after ? unplayedThrough(book, tree, fenKey(after.fen), played) : 0 }
  })
}

/** The book opponent's reply: a random book move, preferring ones toward unplayed lines. */
export function chooseBookReply(
  book: Book,
  tree: OpeningTree,
  fen: string,
  played: ReadonlySet<number>,
  random: Random,
): Uci | null {
  const options = bookMoveOptions(book, tree, fen, played)
  const fresh = options.filter((o) => o.unplayed > 0)
  const pool = fresh.length > 0 ? fresh : options
  if (pool.length === 0) return null
  return pool[Math.floor(random() * pool.length)].uci
}
