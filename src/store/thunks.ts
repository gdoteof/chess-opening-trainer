import { fenKey, playUci, type Uci } from '../domain/chess'
import { explorerMoved, openingChosen } from './drillSlice'
import { currentFenOf, gameCleared, gameStarted, playerMoved } from './gameSlice'
import type { AppThunk } from './index'
import { selectExplorerFen } from './selectors'
import { modeChanged, type Mode } from './settingsSlice'

/** Plays the player's move if it is legal and it is their turn; returns whether it was played. */
export const attemptPlayerMove =
  (uci: Uci): AppThunk<boolean> =>
  (dispatch, getState, services) => {
    const { game, drill } = getState()
    if (game.phase !== 'player') return false
    const fen = currentFenOf(game)
    const move = playUci(fen, uci)
    if (!move) return false

    if (game.mode === 'drill' && drill.opening) {
      const book = services.treeFor(drill.opening).get(fenKey(fen)) ?? []
      if (book.includes(move.uci)) {
        dispatch(playerMoved({ move, judge: false, bookMoves: null }))
      } else {
        const bookMoves = book.map((uci) => ({ uci, san: playUci(fen, uci)!.san }))
        dispatch(playerMoved({ move, judge: true, bookMoves }))
      }
    } else {
      dispatch(playerMoved({ move, judge: true, bookMoves: null }))
    }
    return true
  }

/** Plays a move on the explorer board; only book moves are allowed. */
export const attemptExplorerMove =
  (uci: Uci): AppThunk<boolean> =>
  (dispatch, getState, services) => {
    const fen = selectExplorerFen(getState())
    const move = playUci(fen, uci)
    const bookMoves = services.book.positions.get(fenKey(fen))?.moves ?? []
    if (!move || !bookMoves.includes(move.uci)) return false
    dispatch(explorerMoved(move))
    return true
  }

export const chooseOpening =
  (name: string): AppThunk =>
  (dispatch) => {
    dispatch(openingChosen(name))
    dispatch(startDrill())
  }

export const startDrill = (): AppThunk => (dispatch, getState) => {
  const { drill } = getState()
  if (drill.opening) dispatch(gameStarted({ mode: 'drill', player: drill.side }))
  else dispatch(gameCleared('drill'))
}

export const startBotGame = (): AppThunk => (dispatch, getState) => {
  dispatch(gameStarted({ mode: 'bot', player: getState().bot.side }))
}

export const switchMode =
  (mode: Mode): AppThunk =>
  (dispatch, getState) => {
    if (getState().settings.mode === mode) return
    dispatch(modeChanged(mode))
    if (mode === 'drill') dispatch(startDrill())
    else dispatch(gameCleared('bot'))
  }
