import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { blunderHit, brilliantHit } from '../ceremonies/blunderHit'
import { LoadingCeremony } from '../components/LoadingCeremony'
import { Chapters } from '../components/Chapters'
import { buildChapters } from '../lib/chapters'
import { playSound } from '../lib/sounds'
import { useReviewStore } from '../store/reviewStore'
import type { MoveReview } from '../types'

const SAMPLE_MOVES: MoveReview[] = [
  {
    ply: 1,
    move_number: 1,
    san: 'e4',
    uci: 'e2e4',
    fen_before: '',
    fen_after: '',
    moved_by_white: true,
    label: 'Book',
    win_pct_after: 52,
    cp_after: 20,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 2,
    move_number: 1,
    san: 'e5',
    uci: 'e7e5',
    fen_before: '',
    fen_after: '',
    moved_by_white: false,
    label: 'Book',
    win_pct_after: 50,
    cp_after: 15,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 3,
    move_number: 2,
    san: 'Qh5',
    uci: 'd1h5',
    fen_before: '',
    fen_after: '',
    moved_by_white: true,
    label: 'Inaccuracy',
    win_pct_after: 42,
    win_pct_loss: 8,
    cp_after: -40,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 4,
    move_number: 2,
    san: 'Nc6',
    uci: 'b8c6',
    fen_before: '',
    fen_after: '',
    moved_by_white: false,
    label: 'Best',
    win_pct_after: 45,
    cp_after: -30,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 5,
    move_number: 3,
    san: 'Bc4',
    uci: 'f1c4',
    fen_before: '',
    fen_after: '',
    moved_by_white: true,
    label: 'Good',
    win_pct_after: 48,
    cp_after: -10,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 6,
    move_number: 3,
    san: 'Nf6',
    uci: 'g8f6',
    fen_before: '',
    fen_after: '',
    moved_by_white: false,
    label: 'Best',
    win_pct_after: 55,
    cp_after: 40,
    pv_uci: [],
    pv_san: [],
    is_check: false,
    is_checkmate: false,
    is_stalemate: false,
  },
  {
    ply: 7,
    move_number: 4,
    san: 'Qxf7#',
    uci: 'h5f7',
    fen_before: '',
    fen_after: '',
    moved_by_white: true,
    label: 'Blunder',
    win_pct_after: 12,
    win_pct_loss: 43,
    cp_after: -400,
    pv_uci: [],
    pv_san: [],
    is_check: true,
    is_checkmate: true,
    is_stalemate: false,
  },
]

/** Timing playground. Routed from App.tsx at /sandbox. No prior sandbox page. */
export function Sandbox() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const squareRef = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)
  const setMood = useReviewStore((s) => s.setCoachMood)
  const reducedMotion = useReviewStore((s) => s.reducedMotion)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderCurrent, setLoaderCurrent] = useState(0)
  const chapters = buildChapters(SAMPLE_MOVES, { whiteName: 'Alice', blackName: 'Bob' })

  async function playBlunder() {
    playSound('move')
    await blunderHit(
      { board: boardRef.current, square: squareRef.current, label: labelRef.current },
      { reducedMotion, setMood },
    )
  }

  async function playBrilliant() {
    await brilliantHit({ square: squareRef.current }, { reducedMotion, setMood })
  }

  function replayLoading() {
    setShowLoader(true)
    setLoaderCurrent(0)
    let i = 0
    const total = SAMPLE_MOVES.length
    const timer = window.setInterval(() => {
      i += 1
      setLoaderCurrent(i)
      if (i >= total) window.clearInterval(timer)
    }, 180)
  }

  if (showLoader) {
    return (
      <LoadingCeremony
        current={loaderCurrent}
        total={SAMPLE_MOVES.length}
        moves={SAMPLE_MOVES.slice(0, loaderCurrent)}
        onReady={() => setShowLoader(false)}
        minMs={1500}
      />
    )
  }

  return (
    <div className="page sandbox">
      <Link to="/" className="back">
        ← chessmon
      </Link>
      <h1>Sandbox</h1>
      <p className="lede">Tune ceremonies without waiting on Stockfish.</p>

      <div className="sandbox-actions">
        <button type="button" className="btn primary" onClick={() => void playBlunder()}>
          Play blunder
        </button>
        <button type="button" className="btn ghost" onClick={() => void playBrilliant()}>
          Play brilliant
        </button>
        <button type="button" className="btn ghost" onClick={replayLoading}>
          Replay loading
        </button>
      </div>

      <div className="sandbox-stage" ref={boardRef}>
        <div className="sandbox-square flash-square" ref={squareRef} />
        <div className="blunder-float" ref={labelRef}>
          Blunder -7%
        </div>
      </div>

      <Chapters chapters={chapters} currentPly={7} onJump={() => playSound('chapter')} />
    </div>
  )
}
