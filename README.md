# chessmon

Private local chess game reviewer. Paste a PGN → Stockfish analyzes every move on your PC → move-by-move review with labels, eval bar, eval graph, and better lines.

Working name; rename before sharing publicly.

## Stack

- **Backend:** FastAPI, python-chess, Stockfish 19, SQLite, SSE job progress
- **Frontend:** React + TypeScript (Vite), react-chessboard, Recharts
- **Access:** run on your machine; share with friends via [Tailscale](https://tailscale.com/)

## Requirements

- Python 3.11+
- Node.js 20+
- Stockfish binary (bundled at `backend/bin/stockfish` for linux x86-64, or set `STOCKFISH_PATH`)

Rough machine guide: 4+ CPU cores, 8+ GB RAM. No GPU needed.

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# optional: point at your own Stockfish build
# export STOCKFISH_PATH=/path/to/stockfish

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: http://127.0.0.1:8000/api/health

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to the backend.

### 3. Analyze a game

1. Paste a PGN on the home page (or click **Load sample**).
2. Watch live progress as moves fill in.
3. Navigate with arrow keys, click the move list or eval graph.
4. Reopen games from **Saved reviews**.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `STOCKFISH_PATH` | `backend/bin/stockfish` | Engine binary |
| `ENGINE_POOL_SIZE` | `2` | Concurrent Stockfish processes |
| `ENGINE_HASH_MB` | `128` | Hash per engine |
| `DEFAULT_MOVETIME_MS` | `500` | Think time per position |
| `DATABASE_PATH` | `backend/data/chessmon.db` | SQLite file |
| `CORS_ORIGINS` | localhost Vite origins | Allowed browser origins |

Analysis defaults to **fixed time** (~0.5s/position). You can also send `"depth": 18` in the API body instead of `movetime_ms`.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/games` | `{ "pgn": "..." }` → `{ "job_id" }` |
| `GET` | `/api/games/{id}/events` | SSE: `progress`, `move_result`, `done`, `error` |
| `GET` | `/api/games/{id}` | Full review JSON |
| `GET` | `/api/games` | Saved reviews |
| `POST` | `/api/analyze/position` | Single FEN analysis |

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

## Friend access (Tailscale)

1. Install Tailscale on your PC and your friends’ devices; sign into the same tailnet.
2. Run the backend with `--host 0.0.0.0` (as above).
3. Either:
   - run the Vite dev server bound to `0.0.0.0` (`npm run dev -- --host`), or
   - `npm run build` and serve `frontend/dist` behind any static server / FastAPI static mount.
4. Friends open `http://<your-tailscale-ip>:5173` (or your static port).

No accounts or public hosting required for v1.

## Project layout

```
backend/app/     FastAPI app, engine pool, classifier, SQLite
backend/tests/   pytest (classifier + Stockfish smoke tests)
frontend/src/    React UI
chessmon_architecture_v2.md
```

## Notes

- Cache keys use the **first 4 FEN fields** + analysis settings, so repeated openings are instant.
- One Stockfish process searches one position at a time; the pool avoids friends blocking each other.
- Move labels use win-probability drop (not raw centipawns). Book means the move is still in the opening file (`backend/app/chess/data/openings/`). Brilliant / Great can come later.
