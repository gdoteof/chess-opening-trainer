import { QUALITY_LABEL, type Quality } from '../domain/quality'
import { useAppSelector } from '../store/hooks'
import { Board } from './Board'
import { EvalBar } from './EvalBar'

const LEGEND: Quality[] = ['green', 'yellow', 'orange', 'red']

export function BoardPanel() {
  const { hints, evalBar } = useAppSelector((state) => state.settings)
  return (
    <section className="board-panel" aria-label="Board">
      <div className="board-row">
        {evalBar && <EvalBar />}
        <Board />
      </div>
      {hints && (
        <ul className="legend" aria-label="Hint colors">
          {LEGEND.map((q) => (
            <li key={q}>
              <span className={`swatch swatch--${q}`} aria-hidden="true" />
              {QUALITY_LABEL[q]}
            </li>
          ))}
          <li>
            <span className="swatch swatch--pending" aria-hidden="true" />
            Still analyzing
          </li>
        </ul>
      )}
      <p className="board-tip">
        Right-click and drag to draw an arrow, or right-click a square to mark it. Hold Shift, Ctrl or Alt for
        another color; a left click clears them.
      </p>
    </section>
  )
}
