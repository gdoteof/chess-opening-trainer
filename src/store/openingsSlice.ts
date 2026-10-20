import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Color, PlayedMove } from '../domain/chess'
import { gameStarted, playerMoved } from './gameSlice'

/** Learn: the board shows the book moves. Drill: the player finds them from memory. */
export type Practice = 'learn' | 'drill'

export interface OpeningsState {
  /** The chosen opening; its tree includes every line whose name starts with this. */
  opening: string | null
  side: Color
  practice: Practice
  /** Choosing an opening: the board becomes an explorer whose moves narrow the list. */
  browsing: boolean
  /** Book moves played on the explorer board, from the starting position. */
  explorer: PlayedMove[]
  /** Only list openings meant for this side; null lists them all. */
  listSide: Color | null
  /** Lines of the chosen opening finished in each practice (indices into the book's lines). */
  progress: Record<Practice, number[]>
  /** The line being played: lines it has added to progress, and non-book moves tried. */
  thisLine: { added: number; slips: number }
}

const initialState: OpeningsState = {
  opening: null,
  side: 'w',
  practice: 'learn',
  browsing: true,
  explorer: [],
  listSide: null,
  progress: { learn: [], drill: [] },
  thisLine: { added: 0, slips: 0 },
}

export const openingsSlice = createSlice({
  name: 'openings',
  initialState,
  reducers: {
    /** `side` is the side the opening is meant for, which becomes the side the player takes. */
    openingChosen(state, action: PayloadAction<{ name: string; side: Color }>) {
      const { name, side } = action.payload
      if (state.opening !== name) state.progress = { learn: [], drill: [] }
      state.opening = name
      state.side = side
      state.browsing = false
    },
    practiceChosen(state, action: PayloadAction<Practice>) {
      state.practice = action.payload
    },
    linesFinished(state, action: PayloadAction<number[]>) {
      const finished = state.progress[state.practice]
      for (const id of action.payload) {
        if (finished.includes(id)) continue
        finished.push(id)
        state.thisLine.added++
      }
    },
    progressReset(state) {
      state.progress[state.practice] = []
    },
    sideChosen(state, action: PayloadAction<Color>) {
      state.side = action.payload
    },
    listSideChosen(state, action: PayloadAction<Color | null>) {
      state.listSide = action.payload
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
    builder
      .addCase(gameStarted, (state) => {
        state.thisLine = { added: 0, slips: 0 }
      })
      .addCase(playerMoved, (state, action) => {
        // Book moves are only offered for a move that left the book.
        if (action.payload.bookMoves) state.thisLine.slips++
      })
  },
})

export const {
  openingChosen,
  practiceChosen,
  linesFinished,
  progressReset,
  sideChosen,
  listSideChosen,
  browsingStarted,
  browsingCancelled,
  explorerMoved,
  explorerUndone,
  explorerReset,
} = openingsSlice.actions
