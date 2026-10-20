import { useAppSelector } from '../store/hooks'

export function EngineStatus() {
  const { status, build, error } = useAppSelector((state) => state.engine)
  let text: string
  if (status === 'loading') text = 'Starting Stockfish…'
  else if (status === 'failed') text = `Stockfish failed to start: ${error}. Book drills still work; hints and the bot need the engine.`
  else if (build) {
    const threads = build.threaded ? `${build.threads} threads` : 'single-threaded'
    text = `Stockfish ready (${build.file.replace(/\.js$/, '')}, ${threads})`
  } else text = ''
  return (
    <footer className={`engine-status engine-status--${status}`} role="status">
      {text}
    </footer>
  )
}
