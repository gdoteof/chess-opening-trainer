import { openingTree } from '../domain/book'
import { fenKey, playUci } from '../domain/chess'
import { describeOutcome } from '../domain/outcome'
import { bookMoveOptions, type BookMoveOption } from '../domain/practice'
import { QUALITY_LABEL } from '../domain/quality'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { selectCurrentFen, selectExploring, selectFinishedLines } from '../store/selectors'
import { choosePractice, restartProgress, startBotGame, startLine } from '../store/thunks'
import { ReviewPanel } from './ReviewPanel'

export function StatusPanel() {
  const dispatch = useAppDispatch()
  const game = useAppSelector((state) => state.game)
  const engineStatus = useAppSelector((state) => state.engine.status)
  const { opening, practice, thisLine } = useAppSelector((state) => state.openings)
  const exploring = useAppSelector(selectExploring)
  const finished = useAppSelector(selectFinishedLines)
  const fen = useAppSelector(selectCurrentFen)
  const book = useBook()
  const tree = opening ? openingTree(book, opening) : null

  if (exploring) {
    return (
      <section className="status" aria-live="polite">
        <p className="status-message">Choose an opening to learn or drill.</p>
      </section>
    )
  }
  if (game.phase === 'review') return <ReviewPanel />

  const openings = game.mode === 'openings'
  const learning = openings && practice === 'learn'
  const options = openings && tree && game.phase === 'player' ? bookMoveOptions(book, tree, fen, finished) : []
  let message: string
  let action: { label: string; run: () => void } | null = null
  switch (game.phase) {
    case 'setup':
      message = openings
        ? 'Choose an opening to learn or drill.'
        : engineStatus === 'failed'
          ? 'The bot needs Stockfish, which failed to start.'
          : 'Choose a strength and a color, then start a game.'
      break
    case 'player':
      message = !openings ? 'Your move.' : learning ? learnPrompt(options) : drillPrompt(options)
      break
    case 'opponent':
      message = openings ? 'Your opponent is replying from the book…' : 'The bot is thinking…'
      break
    case 'judging':
      message = 'Checking your move…'
      break
    case 'finished':
      if (game.finish?.kind === 'lineComplete') {
        const total = tree?.lineIds.length ?? 0
        const left = total - finished.size
        const done = learning ? 'learned' : 'drilled'
        if (left > 0) {
          const toGo = `${left} line${left === 1 ? '' : 's'} to go; the next one starts in a moment.`
          if (!learning && thisLine.slips > 0) {
            message = `Line complete, but it took more than one try, so it doesn't count as drilled yet. ${toGo}`
          } else if (thisLine.added === 0) {
            const hint = learning ? 'Follow the bright arrows to reach new lines.' : 'Try different moves next time.'
            message = `Line complete, but you had ${done} this one before. ${hint} ${toGo}`
          } else {
            message = `Line complete. ${toGo}`
          }
        } else if (learning) {
          message = `You've learned all ${total} lines of ${opening}. Now try playing them from memory.`
          action = { label: 'Drill these lines', run: () => dispatch(choosePractice('drill')) }
        } else {
          message = `You've drilled all ${total} lines of ${opening}.`
          action = { label: 'Start over', run: () => dispatch(restartProgress()) }
        }
      } else {
        message = game.finish ? describeOutcome(game.finish.outcome, game.player) : 'Game over.'
        action = openings
          ? { label: 'Play the line again', run: () => dispatch(startLine()) }
          : { label: 'New game', run: () => dispatch(startBotGame()) }
      }
      break
  }

  const verdict = !openings && game.phase !== 'setup' ? game.lastVerdict : null
  return (
    <section className="status" aria-live="polite">
      <p className="status-message">{message}</p>
      {verdict && (
        <p className="status-verdict">
          <span className={`chip chip--${verdict.quality}`}>{QUALITY_LABEL[verdict.quality]}</span>
          your last move
        </p>
      )}
      {learning && options.length > 0 && <BookMoveList fen={fen} options={options} />}
      {openings && game.phase === 'player' && engineStatus === 'loading' && (
        <p className="status-note">Stockfish is still loading; hint colors appear once it is ready.</p>
      )}
      {action && (openings ? opening !== null : true) && (
        <button type="button" className="button button--primary" onClick={action.run}>
          {action.label}
        </button>
      )}
    </section>
  )
}

/** The book moves the arrows show, with the opening each one reaches and the lines it leads to. */
function BookMoveList({ fen, options }: { fen: string; options: BookMoveOption[] }) {
  const book = useBook()
  return (
    <ul className="book-moves" aria-label="Book moves">
      {options.map(({ uci, unplayed }) => {
        const after = playUci(fen, uci)
        if (!after) return null
        const name = book.positions.get(fenKey(after.fen))?.name
        return (
          <li key={uci} className={unplayed > 0 ? 'book-move book-move--new' : 'book-move'}>
            <span className="san">{after.san}</span>
            {name && <span className="book-move-name">{name}</span>}
            <span className="book-move-meta">
              {unplayed > 0 ? `${unplayed} new line${unplayed === 1 ? '' : 's'}` : 'learned'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function learnPrompt(options: BookMoveOption[]): string {
  if (options.length <= 1) return 'Your move. The arrow shows the book move.'
  const fresh = options.filter((o) => o.unplayed > 0).length
  const base = `Your move. The arrows show the ${options.length} book moves`
  if (fresh === 0 || fresh === options.length) return `${base}.`
  return `${base}; the bright ones lead to lines you haven't learned yet.`
}

function drillPrompt(options: BookMoveOption[]): string {
  if (options.length <= 1) return 'Your move. Play the book move.'
  const fresh = options.filter((o) => o.unplayed > 0).length
  const count = `Your move. ${options.length} book moves are possible here`
  if (fresh === 0 || fresh === options.length) return `${count}.`
  return `${count}; ${fresh} of them lead${fresh === 1 ? 's' : ''} to lines you haven't drilled yet.`
}
