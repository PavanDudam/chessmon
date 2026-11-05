import type { MoveReview } from '../types'

type Props = {
  moves: MoveReview[]
  currentPly: number
  onSelect: (ply: number) => void
}

const LABEL_CLASS: Record<string, string> = {
  Book: 'label-book',
  Best: 'label-best',
  Good: 'label-good',
  Inaccuracy: 'label-inaccuracy',
  Mistake: 'label-mistake',
  Blunder: 'label-blunder',
}

const LABEL_SHORT: Record<string, string> = {
  Book: 'Book',
  Best: 'Best',
  Good: 'Good',
  Inaccuracy: 'Inacc.',
  Mistake: 'Mist.',
  Blunder: 'Blund.',
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
  const labelClass = LABEL_CLASS[move.label] ?? ''
  const short = LABEL_SHORT[move.label] ?? move.label
  return (
    <button
      type="button"
      className={`move-item ${active ? 'active' : ''} ${labelClass}`}
      onClick={() => onSelect(move.ply)}
      title={`${move.san} — ${move.label}`}
      aria-label={`${move.san}, ${move.label}`}
    >
      <span className="move-san">{move.san}</span>
      <span className="move-label-text">{short}</span>
    </button>
  )
}

export function MoveList({ moves, currentPly, onSelect }: Props) {
  const rows: { moveNumber: number; white?: MoveReview; black?: MoveReview }[] = []
  for (const move of moves) {
    let row = rows.find((r) => r.moveNumber === move.move_number)
    if (!row) {
      row = { moveNumber: move.move_number }
      rows.push(row)
    }
    if (move.moved_by_white) row.white = move
    else row.black = move
  }

  return (
    <div className="move-list" role="list">
      <button
        type="button"
        className={`move-item start ${currentPly === 0 ? 'active' : ''}`}
        onClick={() => onSelect(0)}
      >
        Start
      </button>
      {rows.map((row) => (
        <div key={row.moveNumber} className="move-row">
          <span className="move-num">{row.moveNumber}.</span>
          {row.white ? (
            <MoveButton
              move={row.white}
              active={currentPly === row.white.ply}
              onSelect={onSelect}
            />
          ) : (
            <span />
          )}
          {row.black ? (
            <MoveButton
              move={row.black}
              active={currentPly === row.black.ply}
              onSelect={onSelect}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  )
}
