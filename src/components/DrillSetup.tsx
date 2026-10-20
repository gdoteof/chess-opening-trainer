import { useDeferredValue, useMemo, useState } from 'react'
import type { Color } from '../domain/chess'
import { drillSideChosen, openingChosen } from '../store/drillSlice'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { startDrill } from '../store/thunks'
import { SidePicker } from './SidePicker'

const MAX_RESULTS = 80

export function DrillSetup() {
  const dispatch = useAppDispatch()
  const { opening, side } = useAppSelector((state) => state.drill)
  const [browsing, setBrowsing] = useState(opening === null)

  const chooseSide = (color: Color) => {
    dispatch(drillSideChosen(color))
    if (opening) dispatch(startDrill())
  }

  if (opening && !browsing) {
    return (
      <section className="setup">
        <p className="setup-current">
          Drilling <strong>{opening}</strong>
        </p>
        <SidePicker label="You play" value={side} onChange={chooseSide} />
        <div className="setup-actions">
          <button type="button" className="button" onClick={() => dispatch(startDrill())}>
            Restart line
          </button>
          <button type="button" className="button" onClick={() => setBrowsing(true)}>
            Change opening
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="setup">
      <SidePicker label="You play" value={side} onChange={(color) => dispatch(drillSideChosen(color))} />
      <OpeningSearch
        onChoose={(name) => {
          dispatch(openingChosen(name))
          dispatch(startDrill())
          setBrowsing(false)
        }}
        onCancel={opening ? () => setBrowsing(false) : undefined}
      />
    </section>
  )
}

function OpeningSearch({ onChoose, onCancel }: { onChoose(name: string): void; onCancel?: () => void }) {
  const book = useBook()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const matches = useMemo(() => {
    const terms = deferred.toLowerCase().split(/\s+/).filter(Boolean)
    const found = book.openings.filter((o) => {
      const haystack = `${o.name} ${o.eco}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
    // Without a query, lead with whole families (names without a variation).
    return terms.length ? found : found.filter((o) => !o.name.includes(':'))
  }, [book, deferred])

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
          autoFocus
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
                {o.eco}
                {o.lineCount > 1 && `, ${o.lineCount} lines`}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="search-empty">No opening matches “{deferred}”.</li>}
        {matches.length > MAX_RESULTS && (
          <li className="search-empty">
            {matches.length - MAX_RESULTS} more; type more of the name to narrow the list.
          </li>
        )}
      </ul>
    </div>
  )
}
