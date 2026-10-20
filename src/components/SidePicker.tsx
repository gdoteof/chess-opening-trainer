import type { Color } from '../domain/chess'

export function SidePicker({ label, value, onChange }: { label: string; value: Color; onChange(color: Color): void }) {
  return (
    <div className="field">
      <span className="field-label" id={`side-${label}`}>
        {label}
      </span>
      <div className="segmented segmented--small" role="group" aria-labelledby={`side-${label}`}>
        {(['w', 'b'] as const).map((color) => (
          <button key={color} type="button" aria-pressed={value === color} onClick={() => onChange(color)}>
            {color === 'w' ? 'White' : 'Black'}
          </button>
        ))}
      </div>
    </div>
  )
}
