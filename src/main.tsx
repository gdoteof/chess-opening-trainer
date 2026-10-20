import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/literata'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './App'
import { buildBook } from './domain/book'
import { loadEngine } from './engine/loadEngine'
import { engineFailed, engineReady } from './store/engineSlice'
import { BookContext } from './store/hooks'
import { createAppStore } from './store/index'
import { createServices } from './store/services'
import { startDrill } from './store/thunks'

const root = createRoot(document.getElementById('root')!)
root.render(<p className="splash">Loading openings…</p>)

// Start the engine download first so it overlaps with indexing the book.
const engine = loadEngine()

void import('./data/openings').then(({ loadOpeningLines }) => {
  const book = buildBook(loadOpeningLines())
  const services = createServices(book)
  const store = createAppStore(services)
  store.dispatch(startDrill())

  engine
    .then(({ engine, build }) => {
      services.engine.current = engine
      store.dispatch(engineReady(build))
    })
    .catch((error: unknown) => {
      console.error('[engine] failed to start', error)
      store.dispatch(engineFailed(error instanceof Error ? error.message : String(error)))
    })

  root.render(
    <StrictMode>
      <Provider store={store}>
        <BookContext.Provider value={book}>
          <App />
        </BookContext.Provider>
      </Provider>
    </StrictMode>,
  )
})
