import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import coachPortrait from '../assets/coach-gnk.jpeg'
import { pointEvalPawns } from '../lib/eval'
import type { MoveReview } from '../types'

type Props = {
  current: number
  total: number
  moves: MoveReview[]
  onReady?: () => void
  minMs?: number
}

const LINES = [
  'Looking for the first swing…',
  'Tracing the opening…',
  'Found a blunder, checking the damage…',
  'Reading the eval swings…',
  'Almost there…',
]

export function LoadingCeremony({ current, total, moves, onReady, minMs = 1500 }: Props) {
  const [started] = useState(() => performance.now())
  const [lineIdx, setLineIdx] = useState(0)
  const n = Math.max(total, moves.length, 1)

  useEffect(() => {
    const t = window.setInterval(() => setLineIdx((i) => (i + 1) % LINES.length), 2200)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (current < total || total <= 0) return
    const elapsed = performance.now() - started
    const wait = Math.max(0, minMs - elapsed)
    const t = window.setTimeout(() => onReady?.(), wait)
    return () => window.clearTimeout(t)
  }, [current, total, started, minMs, onReady])

  const spark = useMemo(() => {
    const pts = [{ ply: 0, eval: 0 }, ...moves.map((m) => ({ ply: m.ply, eval: pointEvalPawns(m) }))]
    const w = 320
    const h = 48
    const pad = 4
    return pts
      .map((p, i) => {
        const x = pad + (p.ply / n) * (w - pad * 2)
        const y = h / 2 - (p.eval / 10) * ((h - pad * 2) / 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [moves, n])

  return (
    <motion.div className="loading-ceremony" layoutId="review-shell" aria-live="polite">
      <div className="loading-inner">
        <p className="brand">chessmon</p>
        <h1 className="loading-title">Reading the story</h1>
        <p className="loading-line">{LINES[lineIdx]}</p>
        <p className="loading-counter mono">
          Analysing move {current} / {total || '…'}
        </p>

        <div className="loading-ticks" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => {
            const move = moves.find((m) => m.ply === i + 1)
            const lit = i < current
            const bad = move?.label === 'Blunder'
            return <span key={i} className={`loading-tick${lit ? ' lit' : ''}${bad ? ' bad' : ''}`} />
          })}
        </div>

        <svg viewBox="0 0 320 48" className="loading-spark" aria-hidden="true">
          <path d={spark} fill="none" className="timeline-path" />
        </svg>

        <div className="loading-coach" aria-hidden="true">
          <div className="coach-face mood-think">
            <img src={coachPortrait} alt="" className="coach-portrait" draggable={false} />
            <span className="coach-lid left" />
            <span className="coach-lid right" />
            <span className="coach-think-dot" />
          </div>
        </div>

        <Link to="/" className="btn ghost loading-cancel">
          Cancel
        </Link>
      </div>
    </motion.div>
  )
}
