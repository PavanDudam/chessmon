import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import { forwardRef } from 'react'
import { ClassificationIcon } from './ClassificationIcon'

type Props = {
  fen: string
  bestMoveUci?: string | null
  orientation?: 'white' | 'black'
  lastToSquare?: string | null
  classification?: string | null
  flashMode?: 'blunder' | 'brilliant' | null
}

function uciToArrow(uci: string): Arrow | null {
  if (!uci || uci.length < 4) return null
  return {
    startSquare: uci.slice(0, 2),
    endSquare: uci.slice(2, 4),
    color: 'rgba(61, 214, 195, 0.75)',
  }
}

function squareToPercent(square: string, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const x = orientation === 'white' ? file : 7 - file
  const y = orientation === 'white' ? 7 - rank : rank
  return { left: `${(x / 8) * 100}%`, top: `${(y / 8) * 100}%` }
}

export const Board = forwardRef<HTMLDivElement, Props>(function Board(
  {
    fen,
    bestMoveUci,
    orientation = 'white',
    lastToSquare = null,
    classification = null,
    flashMode = null,
  },
  ref,
) {
  const arrow = bestMoveUci ? uciToArrow(bestMoveUci) : null
  const badgePos = lastToSquare ? squareToPercent(lastToSquare, orientation) : null

  return (
    <div className="board-wrap" ref={ref}>
      <Chessboard
        options={{
          id: 'chessmon-board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          arrows: arrow ? [arrow] : [],
          boardStyle: {
            width: '100%',
            borderRadius: '4px',
          },
          lightSquareStyle: { backgroundColor: 'var(--sq-light)' },
          darkSquareStyle: { backgroundColor: 'var(--sq-dark)' },
          animationDurationInMs: 280,
        }}
      />
      {badgePos && classification && (
        <div className="board-badge" style={badgePos} aria-hidden="true">
          <ClassificationIcon label={classification} size={18} />
        </div>
      )}
      {badgePos && flashMode && (
        <div className={`board-flash flash-square ${flashMode}`} style={badgePos} aria-hidden="true" />
      )}
    </div>
  )
})
