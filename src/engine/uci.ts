import type { Uci } from '../domain/chess'
import type { Score } from '../domain/score'

export interface InfoLine {
  depth: number
  multipv: number
  score: Score
  /** True for lowerbound/upperbound scores, which are not final for this depth. */
  bound: boolean
  pv: Uci[]
}

/** Parses an `info` line that carries a scored principal variation; null for anything else. */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ')) return null
  const tokens = line.split(' ')
  let depth: number | undefined
  let multipv = 1
  let score: Score | undefined
  let bound = false
  let pv: Uci[] | undefined
  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i])
        break
      case 'multipv':
        multipv = Number(tokens[++i])
        break
      case 'score': {
        const kind = tokens[++i]
        const value = Number(tokens[++i])
        if (kind === 'cp' || kind === 'mate') score = { kind, value }
        if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') {
          bound = true
          i++
        }
        break
      }
      case 'pv':
        pv = tokens.slice(i + 1)
        i = tokens.length
        break
      case 'string':
        return null
    }
  }
  if (depth === undefined || !score || !pv || pv.length === 0) return null
  return { depth, multipv, score, bound, pv }
}

export function isBestMove(line: string): boolean {
  return line.startsWith('bestmove')
}
