import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Color, PlayedMove } from '../domain/chess'

export interface DrillState {
  /** The chosen opening; its tree includes every line whose name starts with this. */
  opening: string | null
  side: Color
  /** Choosing an opening: the board becomes an explorer whose moves narrow the list. */
  browsing: boolean
  /** Book moves played on the explorer board, from the starting position. */
  explorer: PlayedMove[]
}

const initialState: DrillState = { opening: null, side: 'w', browsing: true, explorer: [] }

export const drillSlice = createSlice({
  name: 'drill',
  initialState,
  reducers: {
    openingChosen(state, action: PayloadAction<string>) {
      state.opening = action.payload
      state.browsing = false
    },
    drillSideChosen(state, action: PayloadAction<Color>) {
      state.side = action.payload
    },
    browsingStarted(state) {
      state.browsing = true
    },
    browsingCancelled(state) {
      if (state.opening) state.browsing = false
    },
    explorerMoved(state, action: PayloadAction<PlayedMove>) {
      state.explorer.push(action.payload)
    },
    explorerUndone(state) {
      state.explorer.pop()
    },
    explorerReset(state) {
      state.explorer = []
    },
  },
})

export const {
  openingChosen,
  drillSideChosen,
  browsingStarted,
  browsingCancelled,
  explorerMoved,
  explorerUndone,
  explorerReset,
} = drillSlice.actions
