import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame, subscribeGameEvents } from '../api/client'
import { AccuracySummary } from '../components/AccuracySummary'
import { Board } from '../components/Board'
import { CoachBubble } from '../components/CoachBubble'
import { EvalBar, formatEval } from '../components/EvalBar'
import { EvalGraph } from '../components/EvalGraph'
import { MoveList } from '../components/MoveList'
import type { GameReview, MoveReview } from '../types'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const COACH_KEY = 'chessmon.coach'
const MUTE_KEY = 'chessmon.voice.mute'
const VOLUME_KEY = 'chessmon.voice.volume'

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return 0.8
    const value = Number(raw)
    if (!Number.isFinite(value)) return 0.8
    return Math.min(1, Math.max(0, value))
  } catch {
    return 0.8
  }
}

function readCoachEnabled() {
  try {
    return localStorage.getItem(COACH_KEY) !== '0'
  } catch {
    return true
  }
}

function playerRating(headers: Record<string, string>, side: 'White' | 'Black') {
  const raw = headers[`${side}Elo`] || headers[`${side}Rating`] || ''
  return /^\d+$/.test(raw) ? raw : null
}

export function Review() {
  const { id } = useParams<{ id: string }>()
  const [review, setReview] = useState<GameReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPly, setCurrentPly] = useState(0)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [coachOn, setCoachOn] = useState(readCoachEnabled)
  const [voiceOn, setVoiceOn] = useState(false)
  const [muted, setMuted] = useState(readMuted)
  const [volume, setVolume] = useState(readVolume)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playedPly = useRef<number | null>(null)

  function speakAt(ply: number, enabled: boolean) {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled || !coachOn || muted) {
      audio.pause()
      return
    }
    const move = review?.moves.find((item) => item.ply === ply)
    const url = move?.audio_url
    if (!url) {
      audio.pause()
      return
    }
    audio.volume = volume
    audio.src = url
    playedPly.current = ply
    // Must stay in the click or key handler. Firefox rejects a later play().
    void audio.play().catch(() => undefined)
  }

  function goTo(ply: number) {
    const max = review?.moves.length ?? 0
    const next = Math.max(0, Math.min(max, ply))
    setCurrentPly(next)
    speakAt(next, voiceOn)
  }

  function toggleCoach() {
    setCoachOn((on) => {
      const next = !on
      if (!next) audioRef.current?.pause()
      try {
        localStorage.setItem(COACH_KEY, next ? '1' : '0')
      } catch {
        /* private mode */
      }
      return next
    })
  }

  function toggleVoice() {
    const audio = audioRef.current
    if (voiceOn && audio && !audio.paused) {
      audio.pause()
      setVoiceOn(false)
      return
    }
    setVoiceOn(true)
    speakAt(currentPly, true)
  }

  function toggleMute() {
    setMuted((value) => {
      const next = !value
      if (next) audioRef.current?.pause()
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        /* private mode */
      }
      return next
    })
  }

  function changeVolume(value: number) {
    setVolume(value)
    if (audioRef.current) audioRef.current.volume = value
    try {
      localStorage.setItem(VOLUME_KEY, String(value))
    } catch {
      /* private mode */
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false

    getGame(id)
      .then((data) => {
        if (cancelled) return
        setReview(data)
        setProgress({
          current: data.progress?.current ?? data.moves.length,
          total: data.progress?.total ?? data.moves.length,
        })
        if (data.status === 'completed') {
          setCurrentPly(0)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })

    const unsub = subscribeGameEvents(
      id,
      (event) => {
        if (event.type === 'progress') {
          setProgress({ current: event.current, total: event.total })
          setReview((prev) =>
            prev
              ? { ...prev, status: 'analyzing', progress: { current: event.current, total: event.total } }
              : prev,
          )
        } else if (event.type === 'move_result') {
          setReview((prev) => {
            if (!prev) return prev
            const exists = prev.moves.some((m) => m.ply === event.move.ply)
            const moves = exists
              ? prev.moves.map((m) => (m.ply === event.move.ply ? event.move : m))
              : [...prev.moves, event.move].sort((a, b) => a.ply - b.ply)
            return { ...prev, moves, status: 'analyzing' }
          })
        } else if (event.type === 'done') {
          if (event.review) {
            setReview(event.review)
            setProgress({
              current: event.review.moves.length,
              total: event.review.moves.length,
            })
          } else if (id) {
            getGame(id).then(setReview).catch(() => undefined)
          }
        } else if (event.type === 'error') {
          setError(event.message)
        }
      },
      () => {
        // EventSource errors are common on completion; refresh once.
        if (id) {
          getGame(id)
            .then((data) => {
              if (data.status === 'completed' || data.status === 'error') setReview(data)
            })
            .catch(() => undefined)
        }
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!review) return
      const max = review.moves.length
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(Math.min(max, currentPly + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(Math.max(0, currentPly - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(max)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, currentPly, voiceOn, coachOn, muted, volume])

  const currentMove: MoveReview | null = useMemo(() => {
    if (!review || currentPly <= 0) return null
    return review.moves.find((m) => m.ply === currentPly) ?? null
  }, [review, currentPly])

  const audioPending =
    voiceOn &&
    review?.status === 'completed' &&
    review.moves.some((move) => Boolean(move.comment) && !move.audio_url)

  useEffect(() => {
    if (!id || !audioPending) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      if (tries > 30) {
        window.clearInterval(timer)
        return
      }
      getGame(id)
        .then(setReview)
        .catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [id, audioPending])

  useEffect(() => () => audioRef.current?.pause(), [])

  const fen = currentMove?.fen_after ?? review?.starting_fen ?? START_FEN
  const mate = currentMove?.mate_after ?? null
  const analyzing = review?.status === 'analyzing' || review?.status === 'pending'

  if (error && !review) {
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="page">
        <p className="muted">Loading review…</p>
      </div>
    )
  }

  const whiteName = review.headers.White || 'White'
  const blackName = review.headers.Black || 'Black'
  const whiteRating = playerRating(review.headers, 'White')
  const blackRating = playerRating(review.headers, 'Black')

  return (
    <div className="page review">
      <header className="review-header">
        <Link to="/" className="back">
          ← chessmon
        </Link>
        <div>
          <h1>{review.title}</h1>
          {analyzing && (
            <p className="progress">
              Analyzing move {progress.current} of {progress.total || '…'}
            </p>
          )}
          {review.status === 'error' && (
            <p className="form-error">{review.error || error || 'Analysis failed'}</p>
          )}
        </div>
      </header>

      <AccuracySummary
        whiteName={whiteName}
        blackName={blackName}
        whiteRating={whiteRating}
        blackRating={blackRating}
        white={review.white}
        black={review.black}
      />

      <audio ref={audioRef} className="coach-audio" preload="none" />
      <div className="review-layout">
        <div className="board-column">
          <CoachBubble
            enabled={coachOn}
            onToggle={toggleCoach}
            move={currentMove}
            voiceOn={voiceOn}
            onVoice={toggleVoice}
            muted={muted}
            onMute={toggleMute}
            volume={volume}
            onVolume={changeVolume}
          />
          <div className="board-with-eval">
            <EvalBar
              whiteWinPct={currentMove?.win_pct_after ?? 50}
              cp={currentMove?.cp_after ?? 0}
              mate={mate}
              flipped={orientation === 'black'}
            />
            <Board fen={fen} bestMoveUci={currentMove?.best_move_uci} orientation={orientation} />
          </div>
          <div className="nav-controls">
            <button type="button" className="btn ghost" onClick={() => goTo(0)}>
              ⏮
            </button>
            <button type="button" className="btn ghost" onClick={() => goTo(currentPly - 1)}>
              ◀
            </button>
            <button type="button" className="btn ghost" onClick={() => goTo(currentPly + 1)}>
              ▶
            </button>
            <button type="button" className="btn ghost" onClick={() => goTo(review.moves.length)}>
              ⏭
            </button>
            <button
              type="button"
              className={`btn ghost ${orientation === 'black' ? 'active' : ''}`}
              aria-pressed={orientation === 'black'}
              onClick={() => setOrientation((side) => (side === 'white' ? 'black' : 'white'))}
            >
              {orientation === 'white' ? 'Black' : 'White'}
            </button>
          </div>
          {currentMove && (
            <div className="move-detail">
              <span className={`badge label-${currentMove.label.toLowerCase()}`}>
                {currentMove.label}
              </span>
              <span>
                {currentMove.move_number}
                {currentMove.moved_by_white ? '.' : '...'} {currentMove.san}
              </span>
              <span className="muted">
                Eval {formatEval(currentMove.cp_after, currentMove.mate_after)}
                {currentMove.best_move_san && currentMove.best_move_san !== currentMove.san
                  ? ` · better ${currentMove.best_move_san}`
                  : ''}
              </span>
              {currentMove.pv_san.length > 0 && (
                <p className="pv">Line: {currentMove.pv_san.slice(0, 8).join(' ')}</p>
              )}
            </div>
          )}
          {!currentMove && (
            <div className="move-detail">
              <span className="muted">Starting position · eval {formatEval(0, null)}</span>
            </div>
          )}
        </div>

        <aside className="side-column">
          <EvalGraph moves={review.moves} currentPly={currentPly} onSelect={goTo} />
          <MoveList moves={review.moves} currentPly={currentPly} onSelect={goTo} />
          <p className="hint muted">Arrow keys to navigate · click the graph to jump</p>
        </aside>
      </div>
    </div>
  )
}
