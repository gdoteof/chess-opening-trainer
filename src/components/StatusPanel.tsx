import { describeOutcome } from '../domain/outcome'
import { QUALITY_LABEL } from '../domain/quality'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { startBotGame, startDrill } from '../store/thunks'
import { ReviewPanel } from './ReviewPanel'

export function StatusPanel() {
  const dispatch = useAppDispatch()
  const game = useAppSelector((state) => state.game)
  const engineStatus = useAppSelector((state) => state.engine.status)
  const hasOpening = useAppSelector((state) => state.drill.opening !== null)

  if (game.phase === 'review') return <ReviewPanel />

  const drill = game.mode === 'drill'
  let message: string
  let action: { label: string; run: () => void } | null = null
  switch (game.phase) {
    case 'setup':
      message = drill
        ? 'Choose an opening below, and the side you want to play.'
        : engineStatus === 'failed'
          ? 'The bot needs Stockfish, which failed to start.'
          : 'Choose a strength and a color, then start a game.'
      break
    case 'player':
      message = drill ? 'Your move. Play the book move.' : 'Your move.'
      break
    case 'opponent':
      message = drill ? 'Your opponent is replying from the book…' : 'The bot is thinking…'
      break
    case 'judging':
      message = 'Checking your move…'
      break
    case 'finished':
      if (game.finish?.kind === 'lineComplete') {
        message = 'Line complete. You played every book move to the end of this line.'
        action = { label: 'Drill it again', run: () => dispatch(startDrill()) }
      } else {
        message = game.finish ? describeOutcome(game.finish.outcome, game.player) : 'Game over.'
        action = drill
          ? { label: 'Drill it again', run: () => dispatch(startDrill()) }
          : { label: 'New game', run: () => dispatch(startBotGame()) }
      }
      break
  }

  const verdict = !drill && game.phase !== 'setup' ? game.lastVerdict : null
  return (
    <section className="status" aria-live="polite">
      <p className="status-message">{message}</p>
      {verdict && (
        <p className="status-verdict">
          <span className={`chip chip--${verdict.quality}`}>{QUALITY_LABEL[verdict.quality]}</span>
          your last move
        </p>
      )}
      {drill && game.phase === 'player' && engineStatus === 'loading' && (
        <p className="status-note">Stockfish is still loading; hint colors appear once it is ready.</p>
      )}
      {action && (drill ? hasOpening : true) && (
        <button type="button" className="button button--primary" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
  )
}
