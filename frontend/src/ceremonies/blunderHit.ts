import { animate } from 'motion'
import { FREEZE_MS } from '../motion.config'
import { playSound } from '../lib/sounds'
import type { CoachMood } from '../store/reviewStore'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export type BlunderHitRefs = {
  board: HTMLElement | null
  square: HTMLElement | null
  label: HTMLElement | null
}

export async function blunderHit(
  refs: BlunderHitRefs,
  opts: {
    reducedMotion: boolean
    setMood: (mood: CoachMood) => void
    onDamage?: () => void
  },
) {
  if (opts.reducedMotion) {
    if (refs.square) refs.square.style.outline = '2px solid var(--bad)'
    opts.setMood('wince')
    opts.onDamage?.()
    playSound('blunder')
    await sleep(400)
    opts.setMood('idle')
    if (refs.square) refs.square.style.outline = ''
    return
  }

  await sleep(FREEZE_MS)
  playSound('blunder')
  opts.onDamage?.()
  opts.setMood('wince')

  const animations: Array<Promise<unknown>> = []
  if (refs.board) {
    animations.push(
      animate(refs.board, { x: [0, -7, 6, -3, 0], y: [0, 3, -3, 1, 0] }, { duration: 0.28 }).finished,
    )
  }
  if (refs.square) {
    animations.push(animate(refs.square, { opacity: [0.85, 0] }, { duration: 0.6 }).finished)
  }
  if (refs.label) {
    animations.push(
      animate(refs.label, { opacity: [0, 1, 0], y: [0, -18, -24] }, { duration: 0.7 }).finished,
    )
  }
  await Promise.all(animations)
  await sleep(700)
  opts.setMood('idle')
}

export async function brilliantHit(
  refs: Pick<BlunderHitRefs, 'square'>,
  opts: { reducedMotion: boolean; setMood: (mood: CoachMood) => void },
) {
  playSound('brilliant')
  opts.setMood('cheer')
  if (!opts.reducedMotion && refs.square) {
    await animate(refs.square, { opacity: [0.7, 0] }, { duration: 0.5 }).finished
  }
  await sleep(900)
  opts.setMood('idle')
}
