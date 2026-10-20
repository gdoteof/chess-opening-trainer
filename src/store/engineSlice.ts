import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PositionAnalysis } from '../domain/analysis'
import type { FenKey } from '../domain/chess'
import type { EngineBuild } from '../engine/loadEngine'

export interface EngineState {
  status: 'loading' | 'ready' | 'failed'
  build: EngineBuild | null
  error: string | null
  /** Analysis cache: the deepest analysis seen for each position. */
  analyses: Record<FenKey, PositionAnalysis>
  /** Cache keys, oldest first, for eviction. */
  order: FenKey[]
}

const MAX_CACHED_POSITIONS = 400

const initialState: EngineState = { status: 'loading', build: null, error: null, analyses: {}, order: [] }

export const engineSlice = createSlice({
  name: 'engine',
  initialState,
  reducers: {
    engineReady(state, action: PayloadAction<EngineBuild>) {
      state.status = 'ready'
      state.build = action.payload
    },
    engineFailed(state, action: PayloadAction<string>) {
      state.status = 'failed'
      state.error = action.payload
    },
    analysisUpdated(state, action: PayloadAction<PositionAnalysis>) {
      const incoming = action.payload
      const existing = state.analyses[incoming.fenKey]
      if (!existing) {
        state.order.push(incoming.fenKey)
        if (state.order.length > MAX_CACHED_POSITIONS) delete state.analyses[state.order.shift()!]
      }
      if (!existing || incoming.depth > existing.depth || (incoming.depth === existing.depth && incoming.complete)) {
        state.analyses[incoming.fenKey] = incoming
      } else if (incoming.complete) {
        existing.complete = true
      }
    },
  },
})

export const { engineReady, engineFailed, analysisUpdated } = engineSlice.actions
