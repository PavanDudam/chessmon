import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { springUI } from '../motion.config'
import type { PlayerStats } from '../types'

type Props = {
  whiteName: string
  blackName: string
  whiteRating?: string | null
  blackRating?: string | null
  white: PlayerStats | null
  black: PlayerStats | null
  whiteRunning?: number | null
  blackRunning?: number | null
  winner?: 'white' | 'black' | 'draw' | null
  damageTick?: number
}

function HpBar({
  value,
  color,
  damageTick,
  side,
}: {
  value: number
  color: 'good' | 'warn'
  damageTick: number
  side: 'white' | 'black'
}) {
  const reduced = useReducedMotion()
  const [ghost, setGhost] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (value >= prev.current) {
      setGhost(value)
      prev.current = value
      return
    }
    const drop = prev.current
    prev.current = value
    setGhost(drop)
    const t = window.setTimeout(() => setGhost(value), 400)
    return () => window.clearTimeout(t)
  }, [value, damageTick])

  return (
    <div className={`fighter-hp fighter-hp-${side}`} aria-hidden="true">
      <motion.div
        className={`fighter-hp-ghost ${color}`}
        animate={{ width: `${ghost}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.45 }}
      />
      <motion.div
        className={`fighter-hp-fill ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={reduced ? { duration: 0 } : { ...springUI, duration: 0.7 }}
      />
    </div>
  )
}

function Card({
  name,
  rating,
  side,
  stats,
  running,
  winner,
  damageTick,
}: {
  name: string
  rating?: string | null
  side: 'white' | 'black'
  stats: PlayerStats | null
  running?: number | null
  winner?: 'white' | 'black' | 'draw' | null
  damageTick: number
}) {
  const accuracy = running ?? stats?.accuracy ?? null
  const value = accuracy == null ? 0 : Math.max(0, Math.min(100, accuracy))
  const isWinner = winner === side

  return (
    <div className={`fighter fighter-${side}${isWinner ? ' winner' : ''}`}>
      <div className="fighter-meta">
        <div>
          <strong className="fighter-name">{name}</strong>
          {rating ? <span className="fighter-rating">{rating}</span> : null}
          <span className="fighter-side">{side === 'white' ? 'White' : 'Black'}</span>
        </div>
        <div className="fighter-accuracy mono" aria-label={`${name} accuracy`}>
          {accuracy == null ? '—' : accuracy.toFixed(0)}
          <span className="fighter-pct">%</span>
        </div>
      </div>
      <HpBar
        value={value}
        color={side === 'white' ? 'good' : 'warn'}
        damageTick={damageTick}
        side={side}
      />
    </div>
  )
}

export function FighterCards({
  whiteName,
  blackName,
  whiteRating,
  blackRating,
  white,
  black,
  whiteRunning,
  blackRunning,
  winner = null,
  damageTick = 0,
}: Props) {
  return (
    <div className="fighters">
      <Card
        name={whiteName}
        rating={whiteRating}
        side="white"
        stats={white}
        running={whiteRunning}
        winner={winner}
        damageTick={damageTick}
      />
      <Card
        name={blackName}
        rating={blackRating}
        side="black"
        stats={black}
        running={blackRunning}
        winner={winner}
        damageTick={damageTick}
      />
    </div>
  )
}
