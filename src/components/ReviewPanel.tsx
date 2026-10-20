import { moveNumberOf } from '../domain/chess'
import { describeProofOutcome } from '../domain/proof'
import { QUALITY_LABEL } from '../domain/quality'
import { formatScore } from '../domain/score'
import { moveKept, proofPaused, proofReplayed, proofStepped, tookBack } from '../store/gameSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

/** Shown while play is paused on the player's move: wrong book move, blunder proof, or both. */
export function ReviewPanel() {
  const dispatch = useAppDispatch()
  const { review, mode } = useAppSelector((state) => state.game)
  if (!review) return null
  const { verdict, proof, bookMoves, move, preFen } = review
  const { number, color } = moveNumberOf(preFen)
  const moveLabel = `${number}${color === 'w' ? '.' : '…'} ${move.san}`

  const outcome =
    proof?.reachedEnd && proof.status.kind === 'stopped' ? describeProofOutcome(proof.status.outcome) : null

  return (
    <section className="review" aria-live="polite">
      <header className="review-head">
        {verdict ? (
          <span className={`chip chip--${verdict.quality}`}>{QUALITY_LABEL[verdict.quality]}</span>
        ) : (
          <span className="chip chip--neutral">Not in the book</span>
        )}
        <span className="review-move">{moveLabel}</span>
      </header>

      {bookMoves && (
        <p>
          {bookMoves.length === 1 ? 'The book move here is ' : 'The book moves here are '}
          {bookMoves.map((m, i) => (
            <span key={m.uci}>
              {i > 0 && (i === bookMoves.length - 1 ? ' or ' : ', ')}
              <strong className="san">{m.san}</strong>
            </span>
          ))}
          .
        </p>
      )}

      {verdict && verdict.quality !== 'green' && (
        <p className="review-compare">
          Best was <strong className="san">{verdict.bestSan}</strong> ({formatScore(verdict.bestScore)}); after your
          move the position is {formatScore(verdict.moveScore)}.
        </p>
      )}

      {proof && (
        <div className="proof">
          {outcome ? (
            <>
              <p className="proof-title">{outcome.title}</p>
              <p className="proof-detail">{outcome.detail}</p>
            </>
          ) : (
            <p className="proof-detail">Here is why: watch how your opponent answers.</p>
          )}
          <ProofLine />
          <div className="proof-controls" role="group" aria-label="Proof playback">
            <button
              type="button"
              className="button"
              onClick={() => dispatch(proofStepped(-1))}
              disabled={proof.cursor <= 1}
              aria-label="Step back"
            >
              ‹ Back
            </button>
            {proof.playing ? (
              <button type="button" className="button" onClick={() => dispatch(proofPaused())}>
                Pause
              </button>
            ) : (
              <button type="button" className="button" onClick={() => dispatch(proofReplayed())}>
                Replay
              </button>
            )}
            <button
              type="button"
              className="button"
              onClick={() => dispatch(proofStepped(1))}
              disabled={proof.cursor >= (proof.status.kind === 'stopped' ? proof.status.at : proof.moves.length)}
              aria-label="Step forward"
            >
              Forward ›
            </button>
          </div>
        </div>
      )}

      <div className="review-actions">
        <button type="button" className="button button--primary" onClick={() => dispatch(tookBack())}>
          Take back
        </button>
        {mode === 'bot' && (
          <button type="button" className="button" onClick={() => dispatch(moveKept())}>
            Keep my move
          </button>
        )}
      </div>
    </section>
  )
}

/** The refutation as moves, with the one on the board highlighted. */
function ProofLine() {
  const dispatch = useAppDispatch()
  const review = useAppSelector((state) => state.game.review)
  const proof = review?.proof
  if (!review || !proof) return null
  const shown = proof.status.kind === 'stopped' ? proof.moves.slice(0, proof.status.at) : proof.moves
  const before = moveNumberOf(review.preFen)
  return (
    <ol className="proof-line" aria-label="Refutation">
      {shown.map((m, i) => {
        const ply = (before.color === 'b' ? 1 : 0) + i
        const number = before.number + Math.floor(ply / 2)
        const prefix = ply % 2 === 0 ? `${number}.` : i === 0 ? `${number}…` : ''
        return (
          <li key={i}>
            <button
              type="button"
              className={`proof-move${proof.cursor === i + 1 ? ' proof-move--current' : ''}${i === 0 ? ' proof-move--yours' : ''}`}
              onClick={() => dispatch(proofStepped(i + 1 - proof.cursor))}
            >
              {prefix && <span className="move-number">{prefix}</span>}
              {m.san}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
