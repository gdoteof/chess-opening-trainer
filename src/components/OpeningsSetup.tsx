import { useDeferredValue, useMemo, useState } from 'react'
import { openingsThrough, openingTree, rankForGame } from '../domain/book'
import { fenKey, formatLine, START_FEN, type Color } from '../domain/chess'
import {
  browsingCancelled,
  browsingStarted,
  explorerReset,
  explorerUndone,
  listSideChosen,
  type Practice,
} from '../store/openingsSlice'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { selectExplorerFens } from '../store/selectors'
import { chooseOpening, choosePractice, chooseSide, restartProgress, startLine } from '../store/thunks'
import { Eco } from './Eco'
import { SidePicker } from './SidePicker'
import { SideTag } from './SideTag'

const MAX_RESULTS = 80

const PRACTICES: { practice: Practice; label: string; done: string }[] = [
  { practice: 'learn', label: 'Learn', done: 'learned' },
  { practice: 'drill', label: 'Drill', done: 'drilled' },
]

export function OpeningsSetup() {
  const dispatch = useAppDispatch()
  const book = useBook()
  const { opening, side, practice, browsing, progress } = useAppSelector((state) => state.openings)

  if (opening && !browsing) {
    const total = openingTree(book, opening).lineIds.length
    const meantFor = book.openings.find((o) => o.name === opening)?.side
    const finished = progress[practice].length
    const { done } = PRACTICES.find((p) => p.practice === practice)!
    return (
      <section className="setup">
        <p className="setup-current">
          <strong>{opening}</strong> {meantFor && <SideTag side={meantFor} />}
        </p>
        <div className="field">
          <span className="field-label" id="practice">
            Practice
          </span>
          <div className="segmented segmented--small" role="group" aria-labelledby="practice">
            {PRACTICES.map((p) => (
              <button
                key={p.practice}
                type="button"
                aria-pressed={practice === p.practice}
                onClick={() => dispatch(choosePractice(p.practice))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p className="setup-note">
          {practice === 'learn'
            ? 'Arrows show the book moves. Follow them to learn every line.'
            : 'Find the book moves yourself. A line counts once you play it without a wrong move.'}
        </p>
        <div className="progress">
          <progress max={total} value={finished} aria-label={`Lines ${done}`} />
          <span>
            {finished} of {total} line{total === 1 ? '' : 's'} {done}
          </span>
        </div>
        <SidePicker label="You play" value={side} onChange={(color) => dispatch(chooseSide(color))} />
        {meantFor && side !== meantFor && (
          <p className="setup-note">You're playing against it, as {side === 'w' ? 'White' : 'Black'}.</p>
        )}
        <div className="setup-actions">
          <button type="button" className="button" onClick={() => dispatch(startLine())}>
            Restart line
          </button>
          <button type="button" className="button" onClick={() => dispatch(browsingStarted())}>
            Change opening
          </button>
          {finished > 0 && (
            <button type="button" className="button" onClick={() => dispatch(restartProgress())}>
              Reset progress
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="setup">
      <ListSidePicker />
      <ExplorerLine />
      <OpeningSearch
        onChoose={(name) => dispatch(chooseOpening(name))}
        onCancel={opening ? () => dispatch(browsingCancelled()) : undefined}
      />
    </section>
  )
}

/** Narrows the list to the openings meant for one side. */
function ListSidePicker() {
  const dispatch = useAppDispatch()
  const listSide = useAppSelector((state) => state.openings.listSide)
  const choices: { side: Color | null; label: string }[] = [
    { side: null, label: 'Both' },
    { side: 'w', label: 'White' },
    { side: 'b', label: 'Black' },
  ]
  return (
    <div className="field">
      <span className="field-label" id="list-side">
        Openings for
      </span>
      <div className="segmented segmented--small" role="group" aria-labelledby="list-side">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={listSide === c.side}
            onClick={() => dispatch(listSideChosen(c.side))}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The moves played on the explorer board, which narrow the opening list. */
function ExplorerLine() {
  const dispatch = useAppDispatch()
  const book = useBook()
  const moves = useAppSelector((state) => state.openings.explorer)
  if (moves.length === 0) {
    return <p className="explorer-hint">Play moves on the board to narrow the list to openings that reach that position. Only book moves can be played.</p>
  }
  const atEnd = !book.positions.get(fenKey(moves[moves.length - 1].fen))?.moves.length
  return (
    <div className="explorer">
      <p className="explorer-line">
        Openings reaching <strong className="san">{formatLine(START_FEN, moves)}</strong>
        {atEnd && <span className="explorer-end">No book moves continue from here.</span>}
      </p>
      <div className="setup-actions">
        <button type="button" className="button" onClick={() => dispatch(explorerUndone())}>
          Undo move
        </button>
        <button type="button" className="button" onClick={() => dispatch(explorerReset())}>
          Clear moves
        </button>
      </div>
    </div>
  )
}

function OpeningSearch({ onChoose, onCancel }: { onChoose(name: string): void; onCancel?: () => void }) {
  const book = useBook()
  const explorerFens = useAppSelector(selectExplorerFens)
  const listSide = useAppSelector((state) => state.openings.listSide)
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const explored = explorerFens.length > 1

  const reachable = useMemo(
    () => (explored ? openingsThrough(book, explorerFens) : book.openings),
    [book, explored, explorerFens],
  )

  const matches = useMemo(() => {
    const terms = deferred.toLowerCase().split(/\s+/).filter(Boolean)
    let found = reachable.filter((o) => {
      if (listSide && o.side !== listSide) return false
      const haystack = `${o.name} ${o.eco}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
    // With nothing to go on, lead with whole families (names without a variation).
    if (!terms.length && !explored) found = found.filter((o) => !o.name.includes(':'))
    found = rankForGame(book, explorerFens, found)
    if (!terms.length) return found
    // Names that start with or contain the query as typed come before scattered word matches.
    const phrase = terms.join(' ')
    const closeness = (name: string) => {
      const lower = name.toLowerCase()
      return lower === phrase ? 0 : lower.startsWith(phrase) ? 1 : lower.includes(phrase) ? 2 : 3
    }
    return found.sort((a, b) => closeness(a.name) - closeness(b.name))
  }, [book, deferred, explored, explorerFens, listSide, reachable])

  return (
    <div className="search">
      <div className="search-bar">
        <input
          type="search"
          className="search-input"
          placeholder="Search openings, e.g. Italian or B90"
          aria-label="Search openings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <ul className="search-results" aria-label="Openings">
        {matches.slice(0, MAX_RESULTS).map((o) => (
          <li key={o.name}>
            <button type="button" className="search-result" onClick={() => onChoose(o.name)}>
              <span className="search-result-name">{o.name}</span>
              <span className="search-result-meta">
                <SideTag side={o.side} />
                <span>
                  <Eco code={o.eco} />
                  {o.lineCount > 1 && `, ${o.lineCount} lines`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="search-empty">
            {deferred ? `No opening matches “${deferred}”` : 'No named opening reaches this position'}
            {explored ? ' after these moves.' : '.'}
          </li>
        )}
        {matches.length > MAX_RESULTS && (
          <li className="search-empty">
            {matches.length - MAX_RESULTS} more; type part of a name or play more moves to narrow the list.
          </li>
        )}
      </ul>
    </div>
  )
}
