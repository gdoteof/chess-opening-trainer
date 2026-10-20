import { openingTree } from '../domain/book'
import { fenKey, playUci, type Color, type Uci } from '../domain/chess'
import { explorerMoved, openingChosen, practiceChosen, progressReset, sideChosen, type Practice } from './openingsSlice'
import { currentFenOf, gameCleared, gameStarted, playerMoved } from './gameSlice'
import type { AppThunk } from './index'
import { selectExplorerFen } from './selectors'
import { modeChanged, type Mode } from './settingsSlice'

/** Plays the player's move if it is legal and it is their turn; returns whether it was played. */
export const attemptPlayerMove =
  (uci: Uci): AppThunk<boolean> =>
  (dispatch, getState, services) => {
    const { game, openings } = getState()
    if (game.phase !== 'player') return false
    const fen = currentFenOf(game)
    const move = playUci(fen, uci)
    if (!move) return false

    if (game.mode === 'openings' && openings.opening) {
      const book = openingTree(services.book, openings.opening).moves.get(fenKey(fen)) ?? []
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

/** Chooses an opening to practise, taking the side it is meant for. */
export const chooseOpening =
  (name: string): AppThunk =>
  (dispatch, _getState, services) => {
    const side = services.book.openings.find((o) => o.name === name)?.side ?? 'w'
    dispatch(openingChosen({ name, side }))
    dispatch(startLine())
  }

export const choosePractice =
  (practice: Practice): AppThunk =>
  (dispatch, getState) => {
    if (getState().openings.practice === practice) return
    dispatch(practiceChosen(practice))
    dispatch(startLine())
  }

export const chooseSide =
  (side: Color): AppThunk =>
  (dispatch, getState) => {
    dispatch(sideChosen(side))
    const { opening, browsing } = getState().openings
    if (opening && !browsing) dispatch(startLine())
  }

export const startLine = (): AppThunk => (dispatch, getState) => {
  const { openings } = getState()
  if (openings.opening) dispatch(gameStarted({ mode: 'openings', player: openings.side }))
  else dispatch(gameCleared('openings'))
}

/** Forgets which lines of the opening the current practice has finished, and starts again. */
export const restartProgress = (): AppThunk => (dispatch) => {
  dispatch(progressReset())
  dispatch(startLine())
}

export const startBotGame = (): AppThunk => (dispatch, getState) => {
  dispatch(gameStarted({ mode: 'bot', player: getState().bot.side }))
}

export const switchMode =
  (mode: Mode): AppThunk =>
  (dispatch, getState) => {
    if (getState().settings.mode === mode) return
    dispatch(modeChanged(mode))
    if (mode === 'openings') dispatch(startLine())
    else dispatch(gameCleared('bot'))
  }
