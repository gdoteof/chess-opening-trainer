import { parseOpeningsTsv, type OpeningLine } from '../domain/book'
import a from './openings/a.tsv?raw'
import b from './openings/b.tsv?raw'
import c from './openings/c.tsv?raw'
import d from './openings/d.tsv?raw'
import e from './openings/e.tsv?raw'

/** The lichess-org/chess-openings dataset (CC0), bundled; see scripts/fetch-openings.sh. */
export function loadOpeningLines(): OpeningLine[] {
  return [a, b, c, d, e].flatMap(parseOpeningsTsv)
}
