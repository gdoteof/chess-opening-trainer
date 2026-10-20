import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Mode = 'drill' | 'bot'

export interface SettingsState {
  mode: Mode
  hints: boolean
  evalBar: boolean
}

const initialState: SettingsState = { mode: 'drill', hints: true, evalBar: false }

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    modeChanged(state, action: PayloadAction<Mode>) {
      state.mode = action.payload
    },
    hintsToggled(state) {
      state.hints = !state.hints
    },
    evalBarToggled(state) {
      state.evalBar = !state.evalBar
    },
  },
})

export const { modeChanged, hintsToggled, evalBarToggled } = settingsSlice.actions
