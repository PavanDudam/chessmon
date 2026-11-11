import { useEffect, useState } from 'react'
import type { CoachMood } from '../store/reviewStore'
import type { MoveReview } from '../types'
import coachPortrait from '../assets/coach-gnk.jpeg'

type Props = {
  enabled: boolean
  onToggle: () => void
  move: MoveReview | null
  voiceOn: boolean
  onVoice: () => void
  muted: boolean
  onMute: () => void
  volume: number
  onVolume: (value: number) => void
  mood?: CoachMood
  forceText?: string | null
}

function tagClass(label: string | undefined) {
  if (!label) return 'tag'
  const key = label.toLowerCase()
  if (key === 'best' || key === 'brilliant' || key === 'excellent' || key === 'good') return 'tag good'
  if (key === 'inaccuracy' || key === 'mistake') return 'tag warn'
  if (key === 'blunder') return 'tag'
  return 'tag good'
}

/** Called from Review.tsx beside the board. No other component draws the coach. */
export function CoachBubble({
  enabled,
  onToggle,
  move,
  voiceOn,
  onVoice,
  muted,
  onMute,
  volume,
  onVolume,
  mood = 'idle',
  forceText = null,
}: Props) {
  const comment = forceText ?? (enabled ? (move?.comment?.trim() ?? '') : '')
  const [typed, setTyped] = useState('')
  const talking = Boolean(comment) && typed.length > 0 && typed.length < comment.length

  useEffect(() => {
    if (!comment) {
      setTyped('')
      return
    }
    let i = 0
    setTyped('')
    const interval = window.setInterval(() => {
      i = Math.min(comment.length, i + 2)
      setTyped(comment.slice(0, i))
      if (i >= comment.length) window.clearInterval(interval)
    }, 50)
    return () => window.clearInterval(interval)
  }, [comment])

  const moveMeta = move
    ? `${move.move_number}${move.moved_by_white ? '.' : '...'} ${move.san}${
        move.win_pct_loss != null && move.win_pct_loss >= 1
          ? `  ·  −${move.win_pct_loss.toFixed(0)}%`
          : ''
      }`
    : ''

  return (
    <section className="coach card" aria-label="Coach">
      <CoachFace mood={mood} talking={talking || (Boolean(comment) && voiceOn && !muted)} />
      <div className="coach-main">
        {enabled && move ? (
          <div className="coach-row">
            <span className={tagClass(move.label)}>{move.label}</span>
            <span className="coach-move mono">{moveMeta}</span>
          </div>
        ) : null}
        <p className={`coach-say${comment ? '' : ' muted'}`} aria-live="polite">
          {comment
            ? typed
            : enabled
              ? 'Quiet on routine moves. Speak on swings.'
              : 'Coach is off.'}
        </p>
      </div>
      <div className="coach-ctrl">
        <div className="coach-ctrl-row">
          <button
            type="button"
            className={`btn ghost ${enabled ? 'active' : ''}`}
            aria-pressed={enabled}
            onClick={onToggle}
          >
            Coach {enabled ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className={`btn ghost ${voiceOn ? 'active' : ''}`}
            aria-pressed={voiceOn}
            onClick={onVoice}
            disabled={!enabled}
          >
            Voice
          </button>
          <button
            type="button"
            className={`btn ghost ${muted ? 'active' : ''}`}
            aria-pressed={muted}
            onClick={onMute}
            disabled={!enabled}
          >
            Mute
          </button>
        </div>
        <label className="coach-volume-label">
          Volume
          <input
            className="coach-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Coach volume"
            disabled={!enabled}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  )
}

function CoachFace({ mood, talking }: { mood: CoachMood; talking: boolean }) {
  return (
    <div
      className={`coach-face mood-${mood}${talking ? ' talking' : ''}`}
      aria-hidden="true"
    >
      <img src={coachPortrait} alt="" className="coach-portrait" draggable={false} />

      <span className="coach-lid left" />
      <span className="coach-lid right" />

      <svg className="coach-mouth" viewBox="0 0 40 20" aria-hidden="true">
        {mood === 'cheer' ? (
          <path d="M10 8c4 8 16 8 20 0" fill="none" stroke="#0e0f12" strokeWidth="2.4" strokeLinecap="round" />
        ) : mood === 'wince' ? (
          <path d="M12 14c3-5 13-5 16 0" fill="none" stroke="#0e0f12" strokeWidth="2.4" strokeLinecap="round" />
        ) : talking ? (
          <ellipse className="coach-mouth-open" cx="20" cy="11" rx="5" ry="4" fill="#0e0f12" />
        ) : mood === 'think' ? (
          <path d="M14 12h12" stroke="#0e0f12" strokeWidth="2" strokeLinecap="round" />
        ) : null}
      </svg>

      {mood === 'think' && <span className="coach-think-dot" />}
      {mood === 'wince' && <span className="coach-sweat" />}
    </div>
  )
}
