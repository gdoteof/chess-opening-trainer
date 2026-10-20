import { bookTree, type Book, type BookTree } from '../domain/book'
import type { Random } from '../domain/bot'
import type { EngineService } from '../engine/EngineService'

/** Everything outside Redux that thunks and listeners need, injected at store creation. */
export interface Services {
  book: Book
  /** Set once the engine has loaded. */
  engine: { current: EngineService | null }
  random: Random
  treeFor(opening: string): BookTree
}

export function createServices(book: Book, random: Random = Math.random): Services {
  const trees = new Map<string, BookTree>()
  return {
    book,
    engine: { current: null },
    random,
    treeFor(opening) {
      let tree = trees.get(opening)
      if (!tree) {
        tree = bookTree(book, opening)
        trees.set(opening, tree)
      }
      return tree
    },
  }
}
