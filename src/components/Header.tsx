import { useAppDispatch, useAppSelector } from '../store/hooks'
import { evalBarToggled, hintsToggled, type Mode } from '../store/settingsSlice'
import { switchMode } from '../store/thunks'

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'openings', label: 'Openings' },
  { mode: 'bot', label: 'Play the bot' },
]

export function Header() {
  const dispatch = useAppDispatch()
  const { mode, hints, evalBar } = useAppSelector((state) => state.settings)
  return (
    <header className="header">
      <h1 className="brand">Opening Trainer</h1>
      <nav className="segmented" aria-label="Mode">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => dispatch(switchMode(m.mode))}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div className="toggles">
        <Toggle label="Hints" checked={hints} onChange={() => dispatch(hintsToggled())} />
        <Toggle label="Eval bar" checked={evalBar} onChange={() => dispatch(evalBarToggled())} />
      </div>
    </header>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="toggle-track" aria-hidden="true" />
      {label}
    </label>
  )
}
