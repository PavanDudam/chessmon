import { useMemo, useRef } from 'react'
import type { Chapter } from '../lib/chapters'
import { pointEvalPawns } from '../lib/eval'
import type { MoveReview } from '../types'

type Props = {
  moves: MoveReview[]
  currentPly: number
  chapters?: Chapter[]
  onSelect: (ply: number) => void
  maxPly?: number
}

export function EvalTimeline({ moves, currentPly, chapters = [], onSelect, maxPly }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const total = Math.max(1, maxPly ?? moves.length)

  const points = useMemo(() => {
    return [{ ply: 0, eval: 0 }, ...moves.map((m) => ({ ply: m.ply, eval: pointEvalPawns(m) }))]
  }, [moves])

  const w = 640
  const h = 72
  const pad = 8

  const path = points
    .map((p, i) => {
      const x = pad + (p.ply / total) * (w - pad * 2)
      const y = h / 2 - (p.eval / 10) * ((h - pad * 2) / 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  function plyFromClientX(clientX: number) {
    const el = svgRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * total)
  }

  const cursorX = pad + (currentPly / total) * (w - pad * 2)

  return (
    <div className="eval-timeline">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="eval-timeline-svg"
        role="img"
        aria-label="Evaluation timeline"
        onClick={(e) => onSelect(plyFromClientX(e.clientX))}
      >
        <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} className="timeline-zero" />
        <path d={path} className="timeline-path" fill="none" />
        {chapters.map((c) => {
          const x = pad + (c.endPly / total) * (w - pad * 2)
          return (
            <g key={`${c.startPly}-${c.endPly}`}>
              <line x1={x} x2={x} y1={pad} y2={h - pad} className="timeline-chapter" />
              <title>{c.title}</title>
            </g>
          )
        })}
        <line x1={cursorX} x2={cursorX} y1={2} y2={h - 2} className="timeline-cursor" />
        <circle cx={cursorX} cy={h / 2} r={4} className="timeline-dot" />
      </svg>
    </div>
  )
}
