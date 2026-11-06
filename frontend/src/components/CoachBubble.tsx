import { formatEval } from './EvalBar'
import type { MoveReview } from '../types'

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
}: Props) {
  const comment = move?.comment?.trim() ?? ''
  const talking = enabled && comment.length > 0

  return (
    <section className="coach" aria-label="Coach">
      <Mascot talking={talking} />
      <div className="coach-body">
        <div className="coach-toolbar">
          <button
            type="button"
            className={`btn ghost ${enabled ? 'active' : ''}`}
            aria-pressed={enabled}
            onClick={onToggle}
          >
            Coach {enabled ? 'on' : 'off'}
          </button>
          {enabled && move && (
            <>
              <span className={`badge label-${move.label.toLowerCase()}`}>{move.label}</span>
              <span className="chip">{formatEval(move.cp_after, move.mate_after)}</span>
            </>
          )}
          {enabled && (
            <>
              <button
                type="button"
                className={`btn ghost ${voiceOn ? 'active' : ''}`}
                aria-pressed={voiceOn}
                onClick={onVoice}
              >
                Voice on
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
        {talking && (
          <p className="coach-line" aria-live="polite">
            {comment}
          </p>
        )}
      </div>
    </section>
  )
}

function Mascot({ talking }: { talking: boolean }) {
  return (
    <svg className="coach-mascot" viewBox="0 0 72 72" aria-hidden="true">
      <rect x="22" y="8" width="8" height="10" rx="2" fill="#1f4d3a" />
      <rect x="34" y="6" width="8" height="12" rx="2" fill="#1f4d3a" />
      <rect x="46" y="8" width="8" height="10" rx="2" fill="#1f4d3a" />
      <rect x="16" y="16" width="40" height="40" rx="16" fill="#2f6b4f" />
      <circle cx="30" cy="32" r="3.2" fill="#f7faf7" />
      <circle cx="46" cy="32" r="3.2" fill="#f7faf7" />
      <circle cx="30" cy="33" r="1.4" fill="#1c2420" />
      <circle cx="46" cy="33" r="1.4" fill="#1c2420" />
      {talking ? (
        <path d="M30 44c3 4 9 4 12 0" fill="none" stroke="#f7faf7" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <path d="M30 45h12" fill="none" stroke="#f7faf7" strokeWidth="2.4" strokeLinecap="round" />
      )}
    </svg>
  )
}
