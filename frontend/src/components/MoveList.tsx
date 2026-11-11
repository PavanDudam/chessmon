import { useEffect, useRef, useState } from 'react'
import { ClassificationIcon, showDeltaForLabel } from './ClassificationIcon'
import type { MoveReview } from '../types'

type Props = {
  moves: MoveReview[]
  currentPly: number
  onSelect: (ply: number) => void
}

function MoveButton({
  move,
  active,
  onSelect,
}: {
  move: MoveReview
  active: boolean
  onSelect: (ply: number) => void
}) {
  const showDelta = showDeltaForLabel(move.label)
  const delta =
    showDelta && move.win_pct_loss != null ? `−${move.win_pct_loss.toFixed(0)}%` : null

  return (
    <button
      type="button"
      className={`move-item label-${move.label.toLowerCase()}${active ? ' active' : ''}`}
      onClick={() => onSelect(move.ply)}
      title={`${move.san} — ${move.label}`}
      aria-label={`${move.san}, ${move.label}${delta ? `, ${delta}` : ''}`}
      data-ply={move.ply}
    >
      <span className="move-icon-wrap">
        <ClassificationIcon label={move.label} size={18} />
      </span>
      <span className="move-san mono">{move.san}</span>
      {delta ? <span className="move-delta mono">{delta}</span> : null}
    </button>
  )
}

export function MoveList({ moves, currentPly, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [bookExpanded, setBookExpanded] = useState(false)

  const bookRun: MoveReview[] = []
  for (const m of moves) {
    if (m.label === 'Book') bookRun.push(m)
    else break
  }
  const collapseBook = bookRun.length >= 2 && !bookExpanded
  const restStart = collapseBook ? bookRun.length : 0

  const rows: { moveNumber: number; white?: MoveReview; black?: MoveReview }[] = []
  for (const move of moves.slice(restStart)) {
    let row = rows.find((r) => r.moveNumber === move.move_number)
    if (!row) {
      row = { moveNumber: move.move_number }
      rows.push(row)
    }
    if (move.moved_by_white) row.white = move
    else row.black = move
  }

  useEffect(() => {
    const root = listRef.current
    if (!root) return
    const el = root.querySelector(`[data-ply="${currentPly}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [currentPly])

  return (
    <div className="move-list" role="list" ref={listRef}>
      <button
        type="button"
        className={`move-item start${currentPly === 0 ? ' active' : ''}`}
        onClick={() => onSelect(0)}
        data-ply={0}
      >
        Start
      </button>

      {collapseBook && (
        <button
          type="button"
          className={`move-item book-collapse${
            currentPly > 0 && currentPly <= bookRun[bookRun.length - 1].ply ? ' active' : ''
          }`}
          onClick={() => {
            setBookExpanded(true)
            onSelect(bookRun[bookRun.length - 1].ply)
          }}
          title="Expand book moves"
        >
          <ClassificationIcon label="Book" size={18} />
          <span className="move-san">Book: {bookRun.map((m) => m.san).join(' ')}</span>
        </button>
      )}

      {!collapseBook && bookRun.length >= 2 && bookExpanded && (
        <button type="button" className="move-item book-collapse" onClick={() => setBookExpanded(false)}>
          Collapse book
        </button>
      )}

      {rows.map((row) => (
        <div key={row.moveNumber} className="move-row">
          <span className="move-num mono">{row.moveNumber}.</span>
          {row.white ? (
            <MoveButton move={row.white} active={currentPly === row.white.ply} onSelect={onSelect} />
          ) : (
            <span />
          )}
          {row.black ? (
            <MoveButton move={row.black} active={currentPly === row.black.ply} onSelect={onSelect} />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  )
}
