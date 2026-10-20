import { config } from '../config'
import { botSideChosen, strengthChosen } from '../store/botSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { startBotGame } from '../store/thunks'
import { SidePicker } from './SidePicker'

export function BotSetup() {
  const dispatch = useAppDispatch()
  const { strength, side } = useAppSelector((state) => state.bot)
  const engineStatus = useAppSelector((state) => state.engine.status)
  const playing = useAppSelector((state) => state.game.phase !== 'setup' && state.game.phase !== 'finished')
  const max = strength.kind === 'max'
  const rating = strength.kind === 'rating' ? strength.rating : config.bot.maxRating

  return (
    <section className="setup">
      <div className="field">
        <label className="field-label" htmlFor="bot-rating">
          Bot strength
        </label>
        <div className="strength">
          <input
            id="bot-rating"
            type="range"
            min={config.bot.minRating}
            max={config.bot.maxRating}
            step={config.bot.ratingStep}
            value={rating}
            disabled={max}
            aria-valuetext={max ? 'Max' : `about ${rating}`}
            onChange={(e) => dispatch(strengthChosen({ kind: 'rating', rating: Number(e.target.value) }))}
          />
          <output className="strength-value" htmlFor="bot-rating">
            {max ? 'Max' : `≈${rating}`}
          </output>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={max}
            onChange={(e) => dispatch(strengthChosen(e.target.checked ? { kind: 'max' } : { kind: 'rating', rating }))}
          />
          Max: full-strength Stockfish, always the best move
        </label>
      </div>
      <SidePicker label="You play" value={side} onChange={(color) => dispatch(botSideChosen(color))} />
      <div className="setup-actions">
        <button
          type="button"
          className="button button--primary"
          disabled={engineStatus !== 'ready'}
          onClick={() => dispatch(startBotGame())}
        >
          {engineStatus === 'loading' ? 'Waiting for Stockfish…' : playing ? 'Restart game' : 'Start game'}
        </button>
      </div>
    </section>
  )
}
