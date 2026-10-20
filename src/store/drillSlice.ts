import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Color } from '../domain/chess'

export interface DrillState {
  /** The chosen opening; its tree includes every line whose name starts with this. */
  opening: string | null
  side: Color
}

const initialState: DrillState = { opening: null, side: 'w' }

export const drillSlice = createSlice({
  name: 'drill',
  initialState,
  reducers: {
    openingChosen(state, action: PayloadAction<string | null>) {
      state.opening = action.payload
    },
    drillSideChosen(state, action: PayloadAction<Color>) {
      state.side = action.payload
    },
  },
})

export const { openingChosen, drillSideChosen } = drillSlice.actions
