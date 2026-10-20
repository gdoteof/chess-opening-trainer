import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { config } from '../config'
import type { BotStrength } from '../domain/bot'
import type { Color } from '../domain/chess'

export interface BotState {
  strength: BotStrength
  side: Color
}

const initialState: BotState = {
  strength: { kind: 'rating', rating: config.bot.defaultRating },
  side: 'w',
}

export const botSlice = createSlice({
  name: 'bot',
  initialState,
  reducers: {
    strengthChosen(state, action: PayloadAction<BotStrength>) {
      state.strength = action.payload
    },
    botSideChosen(state, action: PayloadAction<Color>) {
      state.side = action.payload
    },
  },
})

export const { strengthChosen, botSideChosen } = botSlice.actions
