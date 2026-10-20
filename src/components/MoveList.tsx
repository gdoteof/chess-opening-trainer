import { moveNumberOf, type PlayedMove } from '../domain/chess'
import { useAppSelector } from '../store/hooks'

export function MoveList() {
  const { moves, startFen } = useAppSelector((state) => state.game)
  if (moves.length === 0) return null
  const start = moveNumberOf(startFen)
  const rows: { number: number; white?: PlayedMove; black?: PlayedMove }[] = []
  moves.forEach((move, i) => {
    const ply = (start.color === 'b' ? 1 : 0) + i
    const number = start.number + Math.floor(ply / 2)
    if (ply % 2 === 0) rows.push({ number, white: move })
    else if (rows.length === 0) rows.push({ number, black: move })
    else rows[rows.length - 1].black = move
  })
  return (
    <section className="moves" aria-label="Moves">
      <ol className="move-list">
        {rows.map((row) => (
          <li key={row.number} className="move-row">
            <span className="move-number">{row.number}.</span>
            <span className="san">{row.white?.san ?? '…'}</span>
            <span className="san">{row.black?.san ?? ''}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
