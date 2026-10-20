import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  type ListenerEffectAPI,
  type ThunkAction,
  type ThunkDispatch,
  type TypedStartListening,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { botSlice } from './botSlice'
import { openingsSlice } from './openingsSlice'
import { registerEffects } from './effects'
import { engineSlice } from './engineSlice'
import { gameSlice } from './gameSlice'
import type { Services } from './services'
import { settingsSlice } from './settingsSlice'

export const rootReducer = combineReducers({
  settings: settingsSlice.reducer,
  engine: engineSlice.reducer,
  openings: openingsSlice.reducer,
  bot: botSlice.reducer,
  game: gameSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = ThunkDispatch<RootState, Services, UnknownAction>
export type AppThunk<R = void> = ThunkAction<R, RootState, Services, UnknownAction>
export type AppStartListening = TypedStartListening<RootState, AppDispatch, Services>
export type AppListenerApi = ListenerEffectAPI<RootState, AppDispatch, Services>

export function createAppStore(services: Services, preloadedState?: Partial<RootState>) {
  const listeners = createListenerMiddleware({ extra: services })
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: services },
        // The analysis cache is large; walking it on every action makes dev mode sluggish.
        immutableCheck: { ignoredPaths: ['engine.analyses'] },
        serializableCheck: { ignoredPaths: ['engine.analyses'] },
      }).prepend(listeners.middleware),
  })
  registerEffects(listeners.startListening as AppStartListening)
  return store
}

export type AppStore = ReturnType<typeof createAppStore>
