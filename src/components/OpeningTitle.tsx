import { openingAt } from '../domain/book'
import { useAppSelector, useBook } from '../store/hooks'
import { selectExplorerFens, selectExploring, selectGameFens } from '../store/selectors'
import { Eco } from './Eco'

/** The opening name for the game position, set large: it changes as the game moves through the book. */
export function OpeningTitle() {
  const book = useBook()
  const exploring = useAppSelector(selectExploring)
  const gameFens = useAppSelector(selectGameFens)
  const explorerFens = useAppSelector(selectExplorerFens)
  const fens = exploring ? explorerFens : gameFens
  const mode = useAppSelector((state) => state.game.mode)
  const opening = openingAt(book, fens)

  if (!opening) {
    return (
      <div className="opening">
        <h2 className="opening-name opening-name--quiet">Starting position</h2>
      </div>
    )
  }
  const [family, variation] = splitName(opening.name)
  const outOfBook = mode === 'bot' && !opening.inBook
  return (
    <div className={`opening${outOfBook ? ' opening--out' : ''}`}>
      <h2 className="opening-name">
        {family}
        {variation && <span className="opening-variation">{variation}</span>}
      </h2>
      <p className="opening-meta">
        <span className="eco">
          <Eco code={opening.eco} />
        </span>
        {outOfBook && <span>Out of book; this was the last named position.</span>}
      </p>
    </div>
  )
}

/** "Sicilian Defense: Najdorf Variation" → ["Sicilian Defense", "Najdorf Variation"]. */
function splitName(name: string): [string, string | null] {
  const colon = name.indexOf(':')
  return colon < 0 ? [name, null] : [name.slice(0, colon), name.slice(colon + 1).trim()]
}
