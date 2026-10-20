import { openingTree } from '../domain/book'
import { bookMoveOptions } from '../domain/drill'
import { describeOutcome } from '../domain/outcome'
import { QUALITY_LABEL } from '../domain/quality'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { selectCurrentFen, selectExploring, selectPlayedLines } from '../store/selectors'
import { restartProgress, startBotGame, startDrill } from '../store/thunks'
import { ReviewPanel } from './ReviewPanel'

export function StatusPanel() {
  const dispatch = useAppDispatch()
  const game = useAppSelector((state) => state.game)
  const engineStatus = useAppSelector((state) => state.engine.status)
  const opening = useAppSelector((state) => state.drill.opening)
  const repeated = useAppSelector((state) => state.drill.playedThisLine === 0)
  const exploring = useAppSelector(selectExploring)
  const played = useAppSelector(selectPlayedLines)
  const fen = useAppSelector(selectCurrentFen)
  const book = useBook()
  const tree = opening ? openingTree(book, opening) : null

  if (exploring) {
    return (
      <section className="status" aria-live="polite">
        <p className="status-message">Choose an opening to drill.</p>
      </section>
    )
  }
  if (game.phase === 'review') return <ReviewPanel />

  const drill = game.mode === 'drill'
  let message: string
  let action: { label: string; run: () => void } | null = null
  switch (game.phase) {
    case 'setup':
      message = drill
        ? 'Choose an opening to drill.'
        : engineStatus === 'failed'
          ? 'The bot needs Stockfish, which failed to start.'
          : 'Choose a strength and a color, then start a game.'
      break
    case 'player':
      message = drill && tree ? drillPrompt(bookMoveOptions(book, tree, fen, played)) : 'Your move.'
      break
    case 'opponent':
      message = drill ? 'Your opponent is replying from the book…' : 'The bot is thinking…'
      break
    case 'judging':
      message = 'Checking your move…'
      break
    case 'finished':
      if (game.finish?.kind === 'lineComplete') {
        const total = tree?.lineIds.length ?? 0
        const left = total - played.size
        if (left > 0) {
          const toGo = `${left} line${left === 1 ? '' : 's'} to go; the next one starts in a moment.`
          message = repeated
            ? `Line complete, but you had played this one before. Try different moves next time. ${toGo}`
            : `Line complete. ${toGo}`
        } else {
          message = `You've played all ${total} lines of ${opening}.`
          action = { label: 'Start over', run: () => dispatch(restartProgress()) }
        }
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
      {action && (drill ? opening !== null : true) && (
        <button type="button" className="button button--primary" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
  )
}

function drillPrompt(options: { unplayed: number }[]): string {
  if (options.length <= 1) return 'Your move. Play the book move.'
  const fresh = options.filter((o) => o.unplayed > 0).length
  const count = `Your move. ${options.length} book moves are possible here`
  if (fresh === 0 || fresh === options.length) return `${count}.`
  return `${count}; ${fresh} of them lead${fresh === 1 ? 's' : ''} to lines you haven't played yet.`
}
