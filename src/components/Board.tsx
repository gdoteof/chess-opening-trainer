import { Chess } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type Arrow } from 'react-chessboard'
import { config } from '../config'
import { fenKey, legalMoves, parseUci, sideToMove, uciOf, type Square, type Uci } from '../domain/chess'
import { destinationQualities, judgeMove, type Quality } from '../domain/quality'
import { useAppDispatch, useAppSelector, useBook } from '../store/hooks'
import { selectBoardFen, selectBoardLastMove, selectExploring, selectHintAnalysis } from '../store/selectors'
import { attemptExplorerMove, attemptPlayerMove } from '../store/thunks'
import { PromotionPicker } from './PromotionPicker'

type Marker = Quality | 'pending' | 'plain'

/** Arrow colors are SVG attributes, which can't use CSS variables. */
const BOOK_ARROW_COLOR = '#2f8f5b'

const MARKER_COLOR: Record<Marker, string> = {
  green: 'var(--q-green)',
  yellow: 'var(--q-yellow)',
  orange: 'var(--q-orange)',
  red: 'var(--q-red)',
  pending: 'var(--q-pending)',
  plain: 'var(--q-plain)',
}

function markerStyle(marker: Marker, capture: boolean): CSSProperties {
  const color = MARKER_COLOR[marker]
  return {
    backgroundImage: capture
      ? `radial-gradient(circle, transparent 0 62%, ${color} 63% 76%, transparent 77%)`
      : `radial-gradient(circle, ${color} 0 19%, transparent 20%)`,
  }
}

export function Board() {
  const dispatch = useAppDispatch()
  const book = useBook()
  const fen = useAppSelector(selectBoardFen)
  const lastMove = useAppSelector(selectBoardLastMove)
  const hintAnalysis = useAppSelector(selectHintAnalysis)
  const exploring = useAppSelector(selectExploring)
  const drillSide = useAppSelector((state) => state.drill.side)
  const { phase, player, review } = useAppSelector((state) => state.game)
  // On the explorer board either side moves; in a game only the player, on their turn.
  const mover = exploring ? sideToMove(fen) : phase === 'player' ? player : null
  const interactive = mover !== null
  const orientation = exploring ? drillSide : player
  const submit = (uci: Uci) => dispatch(exploring ? attemptExplorerMove(uci) : attemptPlayerMove(uci))

  const [selection, setSelection] = useState<{ fen: string; square: Square } | null>(null)
  const [promotion, setPromotion] = useState<{ fen: string; options: Uci[] } | null>(null)
  const selected = selection?.fen === fen && interactive ? selection.square : null
  const pendingPromotion = promotion?.fen === fen && interactive ? promotion.options : null

  const legal = useMemo(() => {
    if (!interactive) return []
    if (!exploring) return legalMoves(fen)
    const bookMoves = book.positions.get(fenKey(fen))?.moves ?? []
    return legalMoves(fen).filter((m) => bookMoves.includes(uciOf(m)))
  }, [book, exploring, fen, interactive])
  const checkedKing = useMemo(() => kingInCheck(fen), [fen])
  const destinations = selected ? legal.filter((m) => m.from === selected) : []

  const play = (from: string, to: string): boolean => {
    const candidates = legal.filter((m) => m.from === from && m.to === to)
    if (candidates.length === 0) return false
    setSelection(null)
    if (candidates.length > 1) {
      setPromotion({ fen, options: candidates.map(uciOf) })
      return false
    }
    return submit(uciOf(candidates[0]))
  }

  const select = (square: string | null) => {
    if (square && interactive && legal.some((m) => m.from === square)) setSelection({ fen, square: square as Square })
    else setSelection(null)
  }

  const squareStyles: Record<string, CSSProperties> = {}
  const tint = (square: string, style: CSSProperties) => {
    squareStyles[square] = { ...squareStyles[square], ...style }
  }
  if (lastMove) {
    const { from, to } = parseUci(lastMove.uci)
    tint(from, { backgroundColor: 'var(--last-move)' })
    tint(to, { backgroundColor: 'var(--last-move)' })
  }
  if (checkedKing) tint(checkedKing, { backgroundImage: 'radial-gradient(circle, var(--check) 0 35%, transparent 72%)' })
  if (selected) {
    tint(selected, { backgroundColor: 'var(--selected)' })
    const qualities =
      hintAnalysis && hintAnalysis !== 'pending' ? destinationQualities(hintAnalysis, selected, config.quality) : null
    for (const move of destinations) {
      const marker: Marker = !hintAnalysis ? 'plain' : (qualities?.[move.to] ?? 'pending')
      tint(move.to, markerStyle(marker, move.isCapture()))
    }
  }

  const arrows: Arrow[] =
    review?.bookMoves && !review.proof && !exploring
      ? review.bookMoves.map((m) => ({
          startSquare: m.uci.slice(0, 2),
          endSquare: m.uci.slice(2, 4),
          color: BOOK_ARROW_COLOR,
        }))
      : []

  const promotionQualities: Partial<Record<Uci, Quality>> = {}
  if (pendingPromotion && hintAnalysis && hintAnalysis !== 'pending') {
    for (const uci of pendingPromotion) promotionQualities[uci] = judgeMove(hintAnalysis, uci, config.quality)?.quality
  }

  return (
    <div className="board">
      <Chessboard
        options={{
          id: 'trainer',
          position: fen,
          boardOrientation: orientation === 'w' ? 'white' : 'black',
          allowDragging: interactive,
          allowDrawingArrows: false,
          arrows,
          squareStyles,
          animationDurationInMs: 220,
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareNotationStyle: { color: 'var(--board-dark)' },
          darkSquareNotationStyle: { color: 'var(--board-light)' },
          canDragPiece: ({ piece }) => piece.pieceType[0] === mover,
          onPieceDrag: ({ square }) => select(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? play(sourceSquare, targetSquare) : false),
          onSquareClick: ({ square }) => {
            if (selected && destinations.some((m) => m.to === square)) play(selected, square)
            else select(square === selected ? null : square)
          },
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          color={mover ?? player}
          options={pendingPromotion}
          qualities={promotionQualities}
          onPick={(uci) => {
            setPromotion(null)
            submit(uci)
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  )
}

function kingInCheck(fen: string): string | null {
  const chess = new Chess(fen)
  if (!chess.inCheck()) return null
  const turn = chess.turn()
  for (const row of chess.board()) {
    for (const piece of row) if (piece?.type === 'k' && piece.color === turn) return piece.square
  }
  return null
}
