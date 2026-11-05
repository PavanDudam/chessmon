import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'

type Props = {
  fen: string
  bestMoveUci?: string | null
  orientation?: 'white' | 'black'
}

function uciToArrow(uci: string): Arrow | null {
  if (!uci || uci.length < 4) return null
  return {
    startSquare: uci.slice(0, 2),
    endSquare: uci.slice(2, 4),
    color: 'rgba(0, 140, 90, 0.75)',
  }
}

export function Board({ fen, bestMoveUci, orientation = 'white' }: Props) {
  const arrow = bestMoveUci ? uciToArrow(bestMoveUci) : null

  return (
    <div className="board-wrap">
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
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          },
          lightSquareStyle: { backgroundColor: '#e8d5b5' },
          darkSquareStyle: { backgroundColor: '#6b8f71' },
          animationDurationInMs: 180,
        }}
      />
    </div>
  )
}
