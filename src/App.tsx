import { BoardPanel } from './components/BoardPanel'
import { BotSetup } from './components/BotSetup'
import { DrillSetup } from './components/DrillSetup'
import { EngineStatus } from './components/EngineStatus'
import { Header } from './components/Header'
import { MoveList } from './components/MoveList'
import { OpeningTitle } from './components/OpeningTitle'
import { StatusPanel } from './components/StatusPanel'
import { useAppSelector } from './store/hooks'

export default function App() {
  const mode = useAppSelector((state) => state.settings.mode)
  return (
    <div className="app">
      <Header />
      <main className="layout">
        <BoardPanel />
        <aside className="side">
          <OpeningTitle />
          <StatusPanel />
          {mode === 'drill' ? <DrillSetup /> : <BotSetup />}
          <MoveList />
        </aside>
      </main>
      <EngineStatus />
    </div>
  )
}
