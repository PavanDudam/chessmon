import { useEffect, useState } from 'react'
import { formatEval } from '../lib/eval'
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

  return (
    <section className="coach" aria-label="Coach">
      <div className="coach-header">
        <CoachFace mood={mood} talking={talking || (Boolean(comment) && voiceOn && !muted)} />
        <div className="coach-toolbar">
          <button
            type="button"
            className={`btn ghost ${enabled ? 'active' : ''}`}
            aria-pressed={enabled}
            onClick={onToggle}
          >
            Coach {enabled ? 'on' : 'off'}
          </button>
          {enabled && (
            <>
              <button
                type="button"
                className={`btn ghost ${voiceOn ? 'active' : ''}`}
                aria-pressed={voiceOn}
                onClick={onVoice}
              >
                Voice
              </button>
              <button type="button" className="btn ghost" aria-pressed={muted} onClick={onMute}>
                {muted ? 'Muted' : 'Mute'}
              </button>
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
                  onChange={(event) => onVolume(Number(event.target.value))}
                />
              </label>
            </>
          )}
        </div>
      </div>
      <div className="coach-body">
        {enabled && move && (
          <div className="coach-chips">
            <span className={`badge label-${move.label.toLowerCase()}`}>{move.label}</span>
            <span className="chip mono">{formatEval(move.cp_after, move.mate_after)}</span>
          </div>
        )}
        {comment ? (
          <p className="coach-line" aria-live="polite">
            {typed}
          </p>
        ) : (
          <p className="coach-line muted">Quiet on routine moves. Speak on swings.</p>
        )}
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

      {/* Blink lids — timed via CSS animation on idle/think */}
      <span className="coach-lid left" />
      <span className="coach-lid right" />

      {/* Mood / talk mouth drawn over the lower face */}
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
