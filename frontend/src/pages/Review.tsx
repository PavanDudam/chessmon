import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { getGame, subscribeGameEvents } from '../api/client'
import { Board } from '../components/Board'
import { Chapters } from '../components/Chapters'
import { CoachBubble } from '../components/CoachBubble'
import { EvalTimeline } from '../components/EvalTimeline'
import { FighterCards } from '../components/FighterCards'
import { LoadingCeremony } from '../components/LoadingCeremony'
import { MoveList } from '../components/MoveList'
import { ReviewSheet } from '../components/ReviewSheet'
import { EvalBar } from '../components/EvalBar'
import { blunderHit, brilliantHit } from '../ceremonies/blunderHit'
import { buildChapters } from '../lib/chapters'
import { gameWinner, lastToSquare, runningAccuracy } from '../lib/eval'
import { duckBoardSounds, playSound, setBoardMuted } from '../lib/sounds'
import { useReviewStore } from '../store/reviewStore'
import type { GameReview, MoveReview } from '../types'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const COACH_KEY = 'chessmon.coach'
const MUTE_KEY = 'chessmon.voice.mute'
const VOLUME_KEY = 'chessmon.voice.volume'
const THEME_KEY = 'chessmon.theme'

type ThemeMode = 'night' | 'day'

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

function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === 'day' ? 'day' : 'night'
  } catch {
    return 'night'
  }
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme)
}

function playerRating(headers: Record<string, string>, side: 'White' | 'Black') {
  const raw = headers[`${side}Elo`] || headers[`${side}Rating`] || ''
  return /^\d+$/.test(raw) ? raw : null
}

export function Review() {
  const { id } = useParams<{ id: string }>()
  const reducedMotionPref = useReducedMotion()
  const [review, setReview] = useState<GameReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [loaderDone, setLoaderDone] = useState(false)
  const [damageTick, setDamageTick] = useState(0)
  const [flashMode, setFlashMode] = useState<'blunder' | 'brilliant' | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState<'moves' | 'chapters'>('moves')
  const [isMobile, setIsMobile] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme())

  const currentPly = useReviewStore((s) => s.currentPly)
  const orientation = useReviewStore((s) => s.orientation)
  const coachOn = useReviewStore((s) => s.coachOn)
  const voiceOn = useReviewStore((s) => s.voiceOn)
  const muted = useReviewStore((s) => s.muted)
  const volume = useReviewStore((s) => s.volume)
  const coachMood = useReviewStore((s) => s.coachMood)
  const setPly = useReviewStore((s) => s.setPly)
  const setOrientation = useReviewStore((s) => s.setOrientation)
  const setCoachOn = useReviewStore((s) => s.setCoachOn)
  const setVoiceOn = useReviewStore((s) => s.setVoiceOn)
  const setMuted = useReviewStore((s) => s.setMuted)
  const setVolume = useReviewStore((s) => s.setVolume)
  const setCoachMood = useReviewStore((s) => s.setCoachMood)
  const setReducedMotion = useReviewStore((s) => s.setReducedMotion)
  const recordPlyChange = useReviewStore((s) => s.recordPlyChange)
  const resetSession = useReviewStore((s) => s.resetSession)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const flashRef = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)
  const reviewRef = useRef(review)
  useEffect(() => {
    reviewRef.current = review
  }, [review])

  useEffect(() => {
    setReducedMotion(Boolean(reducedMotionPref))
  }, [reducedMotionPref, setReducedMotion])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1000px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    setCoachOn(readCoachEnabled())
    setMuted(readMuted())
    setVolume(readVolume())
    setBoardMuted(readMuted())
    resetSession()
  }, [id, resetSession, setCoachOn, setMuted, setVolume])

  function speakAt(ply: number, enabled: boolean, data: GameReview | null = reviewRef.current) {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled || !coachOn || muted) {
      audio.pause()
      duckBoardSounds(false)
      return
    }
    const move = data?.moves.find((item) => item.ply === ply)
    const url = move?.audio_url
    if (!url) {
      audio.pause()
      duckBoardSounds(false)
      return
    }
    audio.volume = volume
    audio.src = url
    duckBoardSounds(true)
    void audio.play().catch(() => undefined)
    audio.onended = () => duckBoardSounds(false)
  }

  const goTo = useCallback(
    (ply: number) => {
      const data = reviewRef.current
      const max = data?.moves.length ?? 0
      const next = Math.max(0, Math.min(max, ply))
      const scrubbingFast = recordPlyChange()
      setPly(next)

      const move = data?.moves.find((m) => m.ply === next) ?? null
      if (move) {
        if (move.san.includes('x')) playSound('capture')
        else if (move.is_check) playSound('check')
        else playSound('move')
      }

      speakAt(next, voiceOn, data)

      if (!scrubbingFast && move) {
        const reduced = Boolean(reducedMotionPref)
        if (move.label === 'Blunder') {
          setFlashMode('blunder')
          setDamageTick((t) => t + 1)
          void blunderHit(
            { board: boardRef.current, square: flashRef.current, label: labelRef.current },
            {
              reducedMotion: reduced,
              setMood: setCoachMood,
              onDamage: () => setDamageTick((t) => t + 1),
            },
          ).finally(() => setFlashMode(null))
        } else if (move.label === 'Brilliant' || (move.label === 'Best' && (move.win_pct_loss ?? 0) < 0.5 && move.comment)) {
          // Cheer only for brilliant / critical-feeling best with commentary
          if (move.label === 'Brilliant') {
            setFlashMode('brilliant')
            void brilliantHit(
              { square: flashRef.current },
              { reducedMotion: reduced, setMood: setCoachMood },
            ).finally(() => setFlashMode(null))
          }
        }
      }
    },
    [recordPlyChange, reducedMotionPref, setCoachMood, setPly, voiceOn, coachOn, muted, volume],
  )

  function toggleCoach() {
    setCoachOn(!coachOn)
    if (coachOn) audioRef.current?.pause()
    try {
      localStorage.setItem(COACH_KEY, !coachOn ? '1' : '0')
    } catch {
      /* private mode */
    }
  }

  function toggleVoice() {
    const audio = audioRef.current
    if (voiceOn && audio && !audio.paused) {
      audio.pause()
      duckBoardSounds(false)
      setVoiceOn(false)
      return
    }
    setVoiceOn(true)
    speakAt(currentPly, true)
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setBoardMuted(next)
    if (next) audioRef.current?.pause()
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0')
    } catch {
      /* private mode */
    }
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

  function changeTheme(next: ThemeMode) {
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode */
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoaderDone(false)

    getGame(id)
      .then((data) => {
        if (cancelled) return
        setReview(data)
        setProgress({
          current: data.progress?.current ?? data.moves.length,
          total: data.progress?.total ?? data.moves.length,
        })
        if (data.status === 'completed') {
          setPly(0)
          setLoaderDone(true)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })

    let unsub = () => {}
    unsub = subscribeGameEvents(
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
        if (!id) return
        getGame(id)
          .then((data) => {
            if (data.status === 'completed' || data.status === 'error') {
              setReview(data)
              unsub()
            }
          })
          .catch(() => undefined)
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [id, setPly])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!review) return
      const analyzingNow = review.status === 'analyzing' || review.status === 'pending'
      if (analyzingNow && !loaderDone) return
      const max = review.moves.length
      const chapters = buildChapters(review.moves, {
        whiteName: review.headers.White || 'White',
        blackName: review.headers.Black || 'Black',
      })
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
      } else if (e.key === '[') {
        e.preventDefault()
        const prev = [...chapters].reverse().find((c) => c.endPly < currentPly)
        if (prev) goTo(prev.endPly)
      } else if (e.key === ']') {
        e.preventDefault()
        const next = chapters.find((c) => c.endPly > currentPly)
        if (next) goTo(next.endPly)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, currentPly, goTo, loaderDone])

  const currentMove: MoveReview | null = useMemo(() => {
    if (!review || currentPly <= 0) return null
    return review.moves.find((m) => m.ply === currentPly) ?? null
  }, [review, currentPly])

  const chapters = useMemo(() => {
    if (!review) return []
    return buildChapters(review.moves, {
      whiteName: review.headers.White || 'White',
      blackName: review.headers.Black || 'Black',
    })
  }, [review])

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
  const showLoader = Boolean(review && analyzing && !loaderDone)

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

  if (showLoader) {
    return (
      <LoadingCeremony
        current={progress.current}
        total={progress.total || review.moves.length}
        moves={review.moves}
        onReady={() => setLoaderDone(true)}
      />
    )
  }

  const whiteName = review.headers.White || 'White'
  const blackName = review.headers.Black || 'Black'
  const whiteRating = playerRating(review.headers, 'White')
  const blackRating = playerRating(review.headers, 'Black')
  const whiteRunning = runningAccuracy(review.moves, currentPly, true)
  const blackRunning = runningAccuracy(review.moves, currentPly, false)
  const winPct = currentMove?.win_pct_after ?? 50
  const toSquare = lastToSquare(currentMove?.uci)

  const coachNode = (
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
      mood={coachMood}
    />
  )

  const movesNode = <MoveList moves={review.moves} currentPly={currentPly} onSelect={goTo} />
  const chaptersNode = <Chapters chapters={chapters} currentPly={currentPly} onJump={goTo} />

  return (
    <motion.div className="review-hud" layoutId="review-shell">
      <header className="review-topbar">
        <Link to="/" className="back">
          chessmon
        </Link>
        <h1 className="review-title">{review.title}</h1>
        {review.status === 'error' && (
          <p className="form-error">{review.error || error || 'Analysis failed'}</p>
        )}
        <div className="theme-toggle" role="group" aria-label="Color theme">
          <button
            type="button"
            className={theme === 'night' ? 'active' : ''}
            aria-pressed={theme === 'night'}
            onClick={() => changeTheme('night')}
          >
            Night
          </button>
          <button
            type="button"
            className={theme === 'day' ? 'active' : ''}
            aria-pressed={theme === 'day'}
            onClick={() => changeTheme('day')}
          >
            Day
          </button>
        </div>
      </header>

      <FighterCards
        whiteName={whiteName}
        blackName={blackName}
        whiteRating={whiteRating}
        blackRating={blackRating}
        white={review.white}
        black={review.black}
        whiteRunning={whiteRunning}
        blackRunning={blackRunning}
        winner={gameWinner(review.headers)}
        damageTick={damageTick}
      />

      {isMobile && <div className="mobile-coach">{coachNode}</div>}

      <audio ref={audioRef} className="coach-audio" preload="none" />

      <div className="review-main">
        <div className="board-column">
          <div className="board-with-eval">
            <EvalBar
              whiteWinPct={winPct}
              cp={currentMove?.cp_after ?? 0}
              mate={mate}
              flipped={orientation === 'black'}
              classification={currentMove?.label ?? null}
            />
            <div className="board-stage">
              <Board
                ref={boardRef}
                fen={fen}
                bestMoveUci={currentMove?.best_move_uci}
                orientation={orientation}
                lastToSquare={toSquare}
                classification={currentMove?.label ?? null}
                flashMode={flashMode}
              />
              <div className="blunder-float" ref={labelRef} aria-hidden="true">
                Blunder
              </div>
              <div className="flash-hit-target" ref={flashRef} aria-hidden="true" />
            </div>
          </div>

          <div className="nav-controls">
            <button type="button" className="btn ghost" onClick={() => goTo(0)} title="Starting position">
              |&lt; Start
            </button>
            <button type="button" className="btn ghost" onClick={() => goTo(currentPly - 1)} title="Previous move">
              &lt; Prev
            </button>
            <button type="button" className="btn ghost" onClick={() => goTo(currentPly + 1)} title="Next move">
              Next &gt;
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => goTo(review.moves.length)}
              title="Last move"
            >
              End &gt;|
            </button>
            <button
              type="button"
              className={`btn ghost ${orientation === 'black' ? 'active' : ''}`}
              aria-pressed={orientation === 'black'}
              onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}
            >
              Flip
            </button>
            {isMobile && (
              <button
                type="button"
                className="btn ghost nav-panel-btn"
                onClick={() => setSheetOpen(true)}
              >
                Panel
              </button>
            )}
          </div>
        </div>

        {!isMobile && (
          <aside className="side-column">
            {coachNode}
            <div className="side-lists">
              <section className="card side-card">
                <h3 className="side-section-label">Moves</h3>
                <div className="side-card-scroll">{movesNode}</div>
              </section>
              <section className="card side-card">
                <h3 className="side-section-label">Moments</h3>
                <div className="side-card-scroll">{chaptersNode}</div>
              </section>
            </div>
            <section className="card graph-card">
              <EvalTimeline
                moves={review.moves}
                currentPly={currentPly}
                chapters={chapters}
                onSelect={goTo}
              />
            </section>
          </aside>
        )}
      </div>

      {isMobile && (
        <>
          <section className="card graph-card mobile-graph">
            <EvalTimeline
              moves={review.moves}
              currentPly={currentPly}
              chapters={chapters}
              onSelect={goTo}
            />
          </section>
          <ReviewSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            tab={sheetTab}
            onTab={setSheetTab}
            moves={movesNode}
            chapters={chaptersNode}
          />
        </>
      )}
    </motion.div>
  )
}
