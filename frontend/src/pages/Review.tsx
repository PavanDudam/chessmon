import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame, subscribeGameEvents } from '../api/client'
import { AccuracySummary } from '../components/AccuracySummary'
import { Board } from '../components/Board'
import { EvalBar, formatEval } from '../components/EvalBar'
import { EvalGraph } from '../components/EvalGraph'
import { MoveList } from '../components/MoveList'
import type { GameReview, MoveReview } from '../types'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function Review() {
  const { id } = useParams<{ id: string }>()
  const [review, setReview] = useState<GameReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPly, setCurrentPly] = useState(0)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

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
        setCurrentPly((p) => Math.min(max, p + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentPly((p) => Math.max(0, p - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentPly(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentPly(max)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review])

  const currentMove: MoveReview | null = useMemo(() => {
    if (!review || currentPly <= 0) return null
    return review.moves.find((m) => m.ply === currentPly) ?? null
  }, [review, currentPly])

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
        white={review.white}
        black={review.black}
      />

      <div className="review-layout">
        <div className="board-column">
          <div className="board-with-eval">
            <EvalBar
              whiteWinPct={currentMove?.win_pct_after ?? 50}
              cp={currentMove?.cp_after ?? 0}
              mate={mate}
            />
            <Board fen={fen} bestMoveUci={currentMove?.best_move_uci} />
          </div>
          <div className="nav-controls">
            <button type="button" className="btn ghost" onClick={() => setCurrentPly(0)}>
              ⏮
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
            >
              ◀
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCurrentPly((p) => Math.min(review.moves.length, p + 1))}
            >
              ▶
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCurrentPly(review.moves.length)}
            >
              ⏭
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
          <EvalGraph moves={review.moves} currentPly={currentPly} onSelect={setCurrentPly} />
          <MoveList moves={review.moves} currentPly={currentPly} onSelect={setCurrentPly} />
          <p className="hint muted">Arrow keys to navigate · click the graph to jump</p>
        </aside>
      </div>
    </div>
  )
}
