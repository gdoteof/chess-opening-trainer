import type { Book } from '../domain/book'
import type { Random } from '../domain/bot'
import type { EngineService } from '../engine/EngineService'

/** Everything outside Redux that thunks and listeners need, injected at store creation. */
export interface Services {
  book: Book
  /** Set once the engine has loaded. */
  engine: { current: EngineService | null }
  random: Random
}

export function createServices(book: Book, random: Random = Math.random): Services {
  return { book, engine: { current: null }, random }
}
