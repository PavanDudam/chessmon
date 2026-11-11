import type { Chapter } from '../lib/chapters'
import { playSound } from '../lib/sounds'

type Props = {
  chapters: Chapter[]
  currentPly: number
  onJump: (ply: number) => void
}

export function Chapters({ chapters, currentPly, onJump }: Props) {
  if (chapters.length === 0) return null

  return (
    <div className="chapters" aria-label="Game chapters">
      <p className="side-section-label">Moments</p>
      {chapters.map((c) => {
        const active = currentPly >= c.startPly && currentPly <= c.endPly
        return (
          <button
            key={`${c.startPly}-${c.title}`}
            type="button"
            className={`chapter-card${active ? ' active' : ''}`}
            onClick={() => {
              playSound('chapter')
              onJump(c.endPly)
            }}
          >
            <span className="chapter-title">{c.title}</span>
            <span className="chapter-meta mono">
              ply {c.startPly}–{c.endPly}
              {c.swing > 0 ? (
                <span className={`chapter-swing ${c.swing >= 15 ? 'hot' : ''}`}> · {c.swing}%</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
