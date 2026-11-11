import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createGame, listGames } from '../api/client'
import { PgnImport } from '../components/PgnImport'
import type { GameListItem } from '../types'

export function Home() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [games, setGames] = useState<GameListItem[]>([])
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch((err) => setListError(err instanceof Error ? err.message : 'Failed to load games'))
  }, [])

  async function handleSubmit(pgn: string) {
    setBusy(true)
    try {
      const id = await createGame(pgn, { movetime_ms: 500 })
      navigate(`/review/${id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page home">
      <header className="hero">
        <p className="brand">chessmon</p>
        <h1>Import a game</h1>
        <p className="lede">
          Paste a PGN. Stockfish analyzes every move on your machine — fighters, eval, and a
          coach that speaks when the story turns.
        </p>
      </header>

      <section className="panel import-hero">
        <PgnImport onSubmit={handleSubmit} busy={busy} />
      </section>

      <section className="panel saved">
        <h2>Saved reviews</h2>
        {listError && <p className="form-error">{listError}</p>}
        {!listError && games.length === 0 && (
          <p className="muted">No reviews yet. Analyze a game to see it here.</p>
        )}
        <ul className="game-list">
          {games.map((g) => (
            <li key={g.id}>
              <Link to={`/review/${g.id}`} className="game-card">
                <div className="game-card-main">
                  <span className="game-title">{g.title}</span>
                  <span className="game-meta">{g.status}</span>
                </div>
                {g.white_accuracy != null && g.black_accuracy != null && (
                  <div className="accuracy-rings" aria-label="Accuracy">
                    <span className="ring good">{g.white_accuracy.toFixed(0)}</span>
                    <span className="ring warn">{g.black_accuracy.toFixed(0)}</span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="hint muted">
        <Link to="/sandbox">Sandbox</Link> for ceremony timing.
      </p>
    </div>
  )
}
