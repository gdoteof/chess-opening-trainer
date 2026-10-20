import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Color, PlayedMove } from '../domain/chess'
import { gameStarted } from './gameSlice'

export interface DrillState {
  /** The chosen opening; its tree includes every line whose name starts with this. */
  opening: string | null
  side: Color
  /** Choosing an opening: the board becomes an explorer whose moves narrow the list. */
  browsing: boolean
  /** Book moves played on the explorer board, from the starting position. */
  explorer: PlayedMove[]
  /** Lines of the chosen opening played to their end so far (indices into the book's lines). */
  played: number[]
  /** How many of those the current line added. */
  playedThisLine: number
}

const initialState: DrillState = {
  opening: null,
  side: 'w',
  browsing: true,
  explorer: [],
  played: [],
  playedThisLine: 0,
}

export const drillSlice = createSlice({
  name: 'drill',
  initialState,
  reducers: {
    openingChosen(state, action: PayloadAction<string>) {
      if (state.opening !== action.payload) state.played = []
      state.opening = action.payload
      state.browsing = false
    },
    linesPlayed(state, action: PayloadAction<number[]>) {
      for (const id of action.payload) {
        if (state.played.includes(id)) continue
        state.played.push(id)
        state.playedThisLine++
      }
    },
    progressReset(state) {
      state.played = []
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
  extraReducers: (builder) => {
    builder.addCase(gameStarted, (state) => {
      state.playedThisLine = 0
    })
  },
})

export const {
  openingChosen,
  linesPlayed,
  progressReset,
  drillSideChosen,
  browsingStarted,
  browsingCancelled,
  explorerMoved,
  explorerUndone,
  explorerReset,
} = drillSlice.actions
