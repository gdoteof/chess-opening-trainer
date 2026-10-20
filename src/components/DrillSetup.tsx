import { useDeferredValue, useMemo, useState } from 'react'
import { openingsThrough, openingTree, rankForGame } from '../domain/book'
import { fenKey, formatLine, START_FEN, type Color } from '../domain/chess'
import { browsingCancelled, browsingStarted, drillSideChosen, explorerReset, explorerUndone } from '../store/drillSlice'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { selectExplorerFens } from '../store/selectors'
import { chooseOpening, restartProgress, startDrill } from '../store/thunks'
import { Eco } from './Eco'
import { SidePicker } from './SidePicker'

const MAX_RESULTS = 80

export function DrillSetup() {
  const dispatch = useAppDispatch()
  const book = useBook()
  const { opening, side, browsing, played } = useAppSelector((state) => state.drill)

  const chooseSide = (color: Color) => {
    dispatch(drillSideChosen(color))
    if (opening && !browsing) dispatch(startDrill())
  }

  if (opening && !browsing) {
    const total = openingTree(book, opening).lineIds.length
    return (
      <section className="setup">
        <p className="setup-current">
          Drilling <strong>{opening}</strong>
        </p>
        <div className="progress">
          <progress max={total} value={played.length} aria-label="Lines played" />
          <span>
            {played.length} of {total} line{total === 1 ? '' : 's'} played
          </span>
        </div>
        <SidePicker label="You play" value={side} onChange={chooseSide} />
        <div className="setup-actions">
          <button type="button" className="button" onClick={() => dispatch(startDrill())}>
            Restart line
          </button>
          <button type="button" className="button" onClick={() => dispatch(browsingStarted())}>
            Change opening
          </button>
          {played.length > 0 && (
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
      <SidePicker label="You play" value={side} onChange={chooseSide} />
      <ExplorerLine />
      <OpeningSearch
        onChoose={(name) => dispatch(chooseOpening(name))}
        onCancel={opening ? () => dispatch(browsingCancelled()) : undefined}
      />
    </section>
  )
}

/** The moves played on the explorer board, which narrow the opening list. */
function ExplorerLine() {
  const dispatch = useAppDispatch()
  const book = useBook()
  const moves = useAppSelector((state) => state.drill.explorer)
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
  }, [book, deferred, explored, explorerFens, reachable])

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
                <Eco code={o.eco} />
                {o.lineCount > 1 && `, ${o.lineCount} lines`}
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
