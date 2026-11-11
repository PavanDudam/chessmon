import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { formatEval } from '../lib/eval'

export { formatEval }

type Props = {
  whiteWinPct: number | null
  cp?: number | null
  mate?: number | null
  flipped?: boolean
  classification?: string | null
}

function labelText(cp?: number | null, mate?: number | null): string {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  if (cp != null) return formatEval(cp, null)
  return '0.0'
}

/** Loud springs — must overshoot enough to feel on a thin bar. */
const springBreathe = { type: 'spring', stiffness: 260, damping: 14, mass: 0.85 } as const
const springBlunder = { type: 'spring', stiffness: 180, damping: 10, mass: 1 } as const

export function EvalBar({
  whiteWinPct,
  cp,
  mate,
  flipped = false,
  classification = null,
}: Props) {
  const reduced = useReducedMotion()
  const pct = whiteWinPct == null ? 50 : Math.max(2, Math.min(98, whiteWinPct))
  const text = labelText(cp, mate)
  const isHit =
    classification === 'Blunder' ||
    classification === 'Brilliant' ||
    classification === 'Mistake'
  const isBlunder = classification === 'Blunder'

  const [displayGhost, setDisplayGhost] = useState(pct)
  const [ghostVisible, setGhostVisible] = useState(false)
  const prevPct = useRef(pct)
  const [punch, setPunch] = useState(false)
  const punchTimer = useRef<number | null>(null)

  useEffect(() => {
    if (Math.abs(pct - prevPct.current) < 0.15) return
    const from = prevPct.current
    prevPct.current = pct

    // Leave ghost at the OLD value so the trail is visible while live fill moves
    setDisplayGhost(from)
    setGhostVisible(true)

    const clear = window.setTimeout(() => {
      setDisplayGhost(pct)
      setGhostVisible(false)
    }, 550)
    return () => window.clearTimeout(clear)
  }, [pct])

  useEffect(() => {
    if (!isHit || reduced) return
    setPunch(true)
    if (punchTimer.current) window.clearTimeout(punchTimer.current)
    punchTimer.current = window.setTimeout(() => setPunch(false), 700)
    return () => {
      if (punchTimer.current) window.clearTimeout(punchTimer.current)
    }
  }, [text, isHit, classification, reduced])

  const spring = reduced ? { duration: 0 } : isBlunder ? springBlunder : springBreathe
  // scaleY from the white end of the bar
  const originY = flipped ? 0 : 1

  return (
    <div
      className={`eval-bar${flipped ? ' flipped' : ''}${isBlunder ? ' hit-blunder' : ''}${
        classification === 'Brilliant' ? ' hit-brilliant' : ''
      }${punch ? ' punching' : ''}`}
      aria-label={`Evaluation ${text}`}
    >
      <div className="eval-bar-track" aria-hidden="true" />

      {/* Ghost = previous white share (amber), hangs then catches up */}
      <motion.div
        className={`eval-bar-ghost${ghostVisible ? ' show' : ''}`}
        aria-hidden="true"
        style={{ transformOrigin: `center ${originY === 1 ? 'bottom' : 'top'}` }}
        initial={false}
        animate={{ scaleY: displayGhost / 100, opacity: ghostVisible ? 0.85 : 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : ghostVisible
              ? { duration: 0 }
              : { duration: 0.4, ease: 'easeOut' }
        }
      />

      {/* Live white fill — scaleY springs with visible overshoot */}
      <motion.div
        className="eval-bar-fill white"
        style={{ transformOrigin: `center ${originY === 1 ? 'bottom' : 'top'}` }}
        initial={false}
        animate={{ scaleY: pct / 100 }}
        transition={spring}
      />

      {/* Floating punch number — outside the 28px strip so it can be big */}
      <motion.span
        className={`eval-bar-label${punch ? ' punch' : ''}`}
        initial={false}
        animate={
          punch
            ? { scale: 1.85, y: flipped ? 6 : -10, opacity: 1 }
            : { scale: 1, y: 0, opacity: 1 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : punch
              ? { type: 'spring', stiffness: 420, damping: 12 }
              : { type: 'spring', stiffness: 380, damping: 22 }
        }
      >
        {text}
      </motion.span>
    </div>
  )
}
