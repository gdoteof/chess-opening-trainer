import { Chess } from 'chess.js'
import { fenKey, START_FEN, uciOf, type FenKey, type Uci } from './chess'

/** One row of the lichess chess-openings dataset. */
export interface OpeningLine {
  eco: string
  name: string
  sans: string[]
}

export function parseOpeningsTsv(text: string): OpeningLine[] {
  const rows = text.split('\n').map((row) => row.trim()).filter(Boolean)
  const header = rows.shift()?.split('\t') ?? []
  const col = (name: string) => {
    const index = header.indexOf(name)
    if (index < 0) throw new Error(`openings TSV has no "${name}" column`)
    return index
  }
  const [eco, name, pgn] = [col('eco'), col('name'), col('pgn')]
  return rows.map((row) => {
    const cells = row.split('\t')
    return {
      eco: cells[eco],
      name: cells[name],
      sans: cells[pgn].split(/\s+/).filter((token) => !/^\d+\.+$/.test(token)),
    }
  })
}

export interface BookLine {
  eco: string
  name: string
  moves: Uci[]
  /** `fenKeys[i]` is the position before `moves[i]`; the last entry is where the line ends. */
  fenKeys: FenKey[]
}

export interface BookPosition {
  /** Book moves continuing any named line from here. */
  moves: Uci[]
  /** Name of the deepest line that ends at this position, if any does. */
  name?: string
  eco?: string
  namePlies: number
}

export interface OpeningEntry {
  name: string
  eco: string
  /** Number of dataset lines in this opening's tree (itself plus sub-variations). */
  lineCount: number
}

export interface Book {
  lines: BookLine[]
  positions: Map<FenKey, BookPosition>
  /** Distinct opening names, alphabetical. */
  openings: OpeningEntry[]
}

interface TrieNode {
  children: Map<string, TrieNode>
  endingLines: number[]
}

const newNode = (): TrieNode => ({ children: new Map(), endingLines: [] })

/**
 * Indexes every dataset line by position. Lines share long prefixes, so they are merged into
 * a trie of SAN moves first and the trie is walked once with a single board.
 */
export function buildBook(source: OpeningLine[]): Book {
  const root = newNode()
  source.forEach((line, index) => {
    let node = root
    for (const san of line.sans) {
      let child = node.children.get(san)
      if (!child) {
        child = newNode()
        node.children.set(san, child)
      }
      node = child
    }
    node.endingLines.push(index)
  })

  const positions = new Map<FenKey, BookPosition>()
  const lines: BookLine[] = []
  const chess = new Chess(START_FEN)
  const pathMoves: Uci[] = []
  const pathKeys: FenKey[] = []

  const visit = (node: TrieNode) => {
    const key = fenKey(chess.fen())
    pathKeys.push(key)
    let position = positions.get(key)
    if (!position) {
      position = { moves: [], namePlies: -1 }
      positions.set(key, position)
    }
    for (const index of node.endingLines) {
      const { eco, name } = source[index]
      lines.push({ eco, name, moves: [...pathMoves], fenKeys: [...pathKeys] })
      if (pathMoves.length > position.namePlies) {
        position.name = name
        position.eco = eco
        position.namePlies = pathMoves.length
      }
    }
    for (const [san, child] of node.children) {
      let uci: Uci
      try {
        uci = uciOf(chess.move(san))
      } catch {
        console.warn(`openings: illegal move ${san} after ${pathMoves.join(' ')}; skipping`)
        continue
      }
      if (!position.moves.includes(uci)) position.moves.push(uci)
      pathMoves.push(uci)
      visit(child)
      pathMoves.pop()
      chess.undo()
    }
    pathKeys.pop()
  }
  visit(root)

  lines.sort((a, b) => compareNames(a.name, b.name))
  const openings: OpeningEntry[] = []
  for (const line of lines) {
    if (openings[openings.length - 1]?.name === line.name) continue
    openings.push({ name: line.name, eco: line.eco, lineCount: 0 })
  }
  for (const opening of openings) {
    const [start, end] = prefixRange(lines, opening.name)
    opening.lineCount = end - start
  }
  return { lines, positions, openings }
}

const compareNames = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Index range of the lines whose name starts with `prefix`; `lines` is sorted by name. */
function prefixRange(lines: BookLine[], prefix: string): [number, number] {
  const lowerBound = (pred: (name: string) => boolean) => {
    let lo = 0
    let hi = lines.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pred(lines[mid].name)) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  const start = lowerBound((name) => name >= prefix)
  const end = lowerBound((name) => name >= prefix && !name.startsWith(prefix))
  return [start, Math.max(start, end)]
}

/** The chosen opening's lines (its own plus every sub-variation), indexed for drilling. */
export interface OpeningTree {
  /** Book moves per position. */
  moves: Map<FenKey, Uci[]>
  /** Indices into `book.lines` of the lines in the tree. */
  lineIds: number[]
  /** The lines that end at each position. */
  endingAt: Map<FenKey, number[]>
}

const treeCache = new WeakMap<Book, Map<string, OpeningTree>>()

/** The tree of an opening, built once per book and name. */
export function openingTree(book: Book, openingName: string): OpeningTree {
  let trees = treeCache.get(book)
  if (!trees) {
    trees = new Map()
    treeCache.set(book, trees)
  }
  let tree = trees.get(openingName)
  if (!tree) {
    tree = buildTree(book, openingName)
    trees.set(openingName, tree)
  }
  return tree
}

function buildTree(book: Book, openingName: string): OpeningTree {
  const tree: OpeningTree = { moves: new Map(), lineIds: [], endingAt: new Map() }
  const [start, end] = prefixRange(book.lines, openingName)
  for (let id = start; id < end; id++) {
    const line = book.lines[id]
    tree.lineIds.push(id)
    const endKey = line.fenKeys[line.fenKeys.length - 1]
    tree.endingAt.set(endKey, [...(tree.endingAt.get(endKey) ?? []), id])
    line.moves.forEach((move, i) => {
      const key = line.fenKeys[i]
      const moves = tree.moves.get(key)
      if (!moves) tree.moves.set(key, [move])
      else if (!moves.includes(move)) moves.push(move)
    })
  }
  return tree
}

/**
 * The openings that reach the last of `fens` (a game from the starting position), by any
 * move order. An opening qualifies when one of its own lines passes through the position,
 * or when it names a position along the game and one of its sub-variations still reaches
 * this one; a family whose only connection is a stray sub-variation does not.
 */
export function openingsThrough(book: Book, fens: readonly string[]): OpeningEntry[] {
  const key = fenKey(fens[fens.length - 1])
  const own = new Set<string>()
  // passing[i] = number of lines before index i that pass through the position.
  const passing = [0]
  book.lines.forEach((line, i) => {
    const passes = line.fenKeys.includes(key)
    if (passes) own.add(line.name)
    passing.push(passing[i] + (passes ? 1 : 0))
  })
  const path = new Set(namesAlong(book, fens))
  return book.openings.filter((opening) => {
    if (own.has(opening.name)) return true
    if (!path.has(opening.name)) return false
    const [start, end] = prefixRange(book.lines, opening.name)
    return passing[end] - passing[start] > 0
  })
}

/** Names of the named positions along a game, deepest first, without repeats. */
export function namesAlong(book: Book, fens: readonly string[]): string[] {
  const names: string[] = []
  for (let i = fens.length - 1; i >= 0; i--) {
    const name = book.positions.get(fenKey(fens[i]))?.name
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/**
 * Orders openings for a position reached by the game `fens`: names along the game first
 * (deepest first), then the rest of the current position's family, then everything else.
 * The sort is stable, so each group keeps its incoming (alphabetical) order.
 */
export function rankForGame(book: Book, fens: readonly string[], openings: OpeningEntry[]): OpeningEntry[] {
  const path = namesAlong(book, fens)
  const family = path[0]?.split(':')[0]
  const rank = (name: string) => {
    const index = path.indexOf(name)
    if (index >= 0) return index
    return family && name.startsWith(`${family}:`) ? path.length : path.length + 1
  }
  return [...openings].sort((a, b) => rank(a.name) - rank(b.name))
}

export interface OpeningName {
  name: string
  eco: string
  /** Whether the current position itself is a book position. */
  inBook: boolean
}

/** The opening name for the last of `fens`: the most recent position along the game that has one. */
export function openingAt(book: Book, fens: readonly string[]): OpeningName | null {
  const inBook = book.positions.has(fenKey(fens[fens.length - 1]))
  for (let i = fens.length - 1; i >= 0; i--) {
    const position = book.positions.get(fenKey(fens[i]))
    if (position?.name && position.eco) return { name: position.name, eco: position.eco, inBook }
  }
  return null
}
