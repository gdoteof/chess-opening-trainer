import { defaultPieces } from 'react-chessboard'
import type { Color, Uci } from '../domain/chess'
import { QUALITY_LABEL, type Quality } from '../domain/quality'

const PIECE_NAME: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }
const ORDER = ['q', 'r', 'b', 'n']

interface Props {
  color: Color
  options: Uci[]
  qualities: Partial<Record<Uci, Quality>>
  onPick(uci: Uci): void
  onCancel(): void
}

export function PromotionPicker({ color, options, qualities, onPick, onCancel }: Props) {
  const sorted = [...options].sort((a, b) => ORDER.indexOf(a[4]) - ORDER.indexOf(b[4]))
  return (
    <div className="promotion" role="dialog" aria-label="Choose a promotion piece" onClick={onCancel}>
      <div className="promotion-choices" onClick={(e) => e.stopPropagation()}>
        {sorted.map((uci) => {
          const piece = uci[4]
          const quality = qualities[uci]
          const label = `${PIECE_NAME[piece]}${quality ? ` (${QUALITY_LABEL[quality].toLowerCase()})` : ''}`
          return (
            <button
              key={uci}
              type="button"
              className={`promotion-choice${quality ? ` quality-ring--${quality}` : ''}`}
              aria-label={label}
              title={label}
              onClick={() => onPick(uci)}
            >
              {defaultPieces[`${color}${piece.toUpperCase()}`]()}
            </button>
          )
        })}
        <button type="button" className="promotion-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
