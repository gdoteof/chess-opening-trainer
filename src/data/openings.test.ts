import { describe, expect, it, vi } from 'vitest'
import { buildBook } from '../domain/book'
import { fenKey, START_FEN } from '../domain/chess'
import { loadOpeningLines } from './openings'

describe('bundled openings dataset', () => {
  it('indexes every line without illegal moves', () => {
    const warn = vi.spyOn(console, 'warn')
    const source = loadOpeningLines()
    const book = buildBook(source)
    expect(warn).not.toHaveBeenCalled()
    expect(book.lines).toHaveLength(source.length)
    expect(source.length).toBeGreaterThan(3000)
    expect(book.positions.get(fenKey(START_FEN))?.moves.length).toBeGreaterThan(15)
    expect(book.openings.find((o) => o.name === 'Italian Game')?.lineCount).toBeGreaterThan(20)
  })
})
