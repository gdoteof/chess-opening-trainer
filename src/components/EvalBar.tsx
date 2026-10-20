import { formatScore, type Score } from '../domain/score'
import { useAppSelector } from '../store/hooks'
import { selectBoardEval } from '../store/selectors'

/** Share of the bar that belongs to the player: a logistic curve so ±4 pawns is nearly full. */
function playerShare(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 1 : 0
  return 1 / (1 + Math.exp(-score.value / 250))
}

/** One decimal so the label fits the bar: "+0.6", "−2.3", "M3". */
function shortLabel(score: Score): string {
  if (score.kind === 'mate') return score.value > 0 ? `M${score.value}` : `−M${-score.value}`
  const pawns = Math.abs(score.value / 100).toFixed(1)
  return score.value < 0 ? `−${pawns}` : `+${pawns}`
}

export function EvalBar() {
  const evaluation = useAppSelector(selectBoardEval)
  const player = useAppSelector((state) => state.game.player)
  const share = evaluation ? playerShare(evaluation.score) : 0.5
  const label = evaluation ? shortLabel(evaluation.score) : '…'
  return (
    <div
      className={`eval-bar eval-bar--${player === 'w' ? 'white' : 'black'}`}
      role="meter"
      aria-label="Evaluation for you"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={evaluation ? formatScore(evaluation.score) : 'not analyzed yet'}
    >
      <div className="eval-bar-fill" style={{ height: `${share * 100}%` }} />
      <span className={`eval-bar-label${share >= 0.5 ? ' eval-bar-label--bottom' : ''}`}>{label}</span>
    </div>
  )
}
