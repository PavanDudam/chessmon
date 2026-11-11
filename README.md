# chessmon

Private local chess game reviewer. Paste a PGN → Stockfish analyzes every move on your PC → move-by-move review with labels, accuracy, an eval bar, an eval graph, better lines, and a coach that can speak.

Working name; rename before sharing publicly.

## Stack

- **Backend:** FastAPI, python-chess, Stockfish 19, Piper, SQLite, SSE job progress
- **Frontend:** React + TypeScript (Vite), react-chessboard, Recharts
- **Access:** run on your machine; share with friends via [Tailscale](https://tailscale.com/)

## Requirements

- Python 3.11+
- Node.js 20+
- Stockfish binary (bundled at `backend/bin/stockfish` for linux x86-64, or set `STOCKFISH_PATH`)
- Piper binary and the `en_US-lessac-medium` voice (bundled at `backend/bin/piper/`). Without Piper the coach stays text-only.

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

Open http://127.0.0.1:5173. Vite listens on the network and proxies `/api` and `/audio` to the backend.

### 3. Analyze a game

1. Paste a PGN on the home page (or click **Load sample**).
2. Watch live progress as moves fill in.
3. Navigate with arrow keys, the move list, or the eval graph. Flip the board with **White** / **Black**.
4. Read the coach beside the board. Turn **Voice** on, then step to a move to hear that line. Mute and volume are remembered in the browser.
5. Reopen games from **Saved reviews**. Each row shows both players' accuracy.

## Review screen

- **Players.** Names and Elo (or Rating) from the PGN, plus accuracy and a count of each move label.
- **Labels.** Book, Best, Excellent, Good, Inaccuracy, Mistake, Blunder. Book means the move is still in the opening file (`backend/app/chess/data/openings/`). Labels use win-probability drop, not raw centipawns. Brilliant / Great can come later.
- **Board.** Eval bar, best-move arrow, and a flip button. The eval bar flips with the board. The number stays White's point of view.
- **Coach.** One short comment per move, stored with the review. Toggle it off; that choice is remembered.
- **Voice.** Piper turns the comment into a WAV under `backend/data/audio/`, served at `/audio/<hash>.wav`. The same sentence is generated once and reused. Voice starts off. On the starting position there is no line; step to a move after turning Voice on.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `STOCKFISH_PATH` | `backend/bin/stockfish` | Engine binary |
| `ENGINE_POOL_SIZE` | `2` | Concurrent Stockfish processes |
| `ENGINE_HASH_MB` | `128` | Hash per engine |
| `DEFAULT_MOVETIME_MS` | `500` | Think time per position |
| `DATABASE_PATH` | `backend/data/chessmon.db` | SQLite file |
| `AUDIO_DIR` | `backend/data/audio` | Cached coach WAVs |
| `PIPER_BIN` | `backend/bin/piper/piper` | Piper binary |
| `PIPER_MODEL` | `en_US-lessac-medium` | Voice name used in the cache key |
| `PIPER_MODEL_PATH` | bundled `.onnx` if present | Model file passed to Piper |
| `PIPER_TIMEOUT_S` | `30` | Seconds allowed per line |
| `CORS_ORIGINS` | localhost Vite origins | Allowed browser origins |

Analysis defaults to **fixed time** (~0.5s/position). You can also send `"depth": 18` in the API body instead of `movetime_ms`.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/games` | `{ "pgn": "..." }` → `{ "job_id" }` |
| `GET` | `/api/games/{id}/events` | SSE: `progress`, `move_result`, `done`, `error` |
| `GET` | `/api/games/{id}` | Full review JSON, including `comment` and `audio_url` on each move |
| `GET` | `/api/games` | Saved reviews |
| `GET` | `/audio/{file}.wav` | One cached coach clip |
| `POST` | `/api/analyze/position` | Single FEN analysis |

A finished review sends one `done` event and closes the stream. The page closes its side too, so it does not keep reconnecting.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Covers the classifier, openings, commentary, speakable text, Piper cache, terminal positions, and a Stockfish smoke test.


## Deploy (Render + Cloudflare Pages)

Previous games are **not** persisted across Render deploys (ephemeral disk). Analysis and coach voice still work.

### Backend on Render

1. Create a **Web Service** from this repo using Docker.
2. Dockerfile path: `backend/Dockerfile`, context: `backend` (or use root [`render.yaml`](render.yaml)).
3. Set env:
   - `CORS_ORIGINS` = your Cloudflare Pages URL (e.g. `https://chessmon.pages.dev`)
   - Optional: `ENGINE_POOL_SIZE=1`, `ENGINE_HASH_MB=64`
4. Health check: `/api/health`
5. The image downloads Stockfish + Piper at build time (binaries are not in git).

### Frontend on Cloudflare Pages

1. Root directory: `frontend`
2. Build command: `npm ci && npm run build`
3. Output directory: `dist`
4. Environment variable: `VITE_API_URL` = your Render API origin (no trailing slash), e.g. `https://chessmon-api.onrender.com`
5. SPA routing uses `public/_redirects` (`/* → /index.html`).

Local `npm run dev` needs **no** `VITE_API_URL` (Vite proxies `/api` and `/audio`).

## Friend access (Tailscale)

1. Install Tailscale on your PC and your friends' devices; sign into the same tailnet.
2. Start the backend and `npm run dev`. The dev server already listens on the network. Friends open `http://<your-tailscale-ip>:5173`.
3. Vite proxies `/api` and `/audio` to `127.0.0.1:8000`, so the backend does not have to be reachable on the tailnet. Use `--host 0.0.0.0` only if someone calls the API directly.
4. Or `npm run build` and serve `frontend/dist` behind any static server, with `/api` and `/audio` proxied to the backend.

No accounts or public hosting required for v1.

## Project layout

```
backend/app/          FastAPI app, engine pool, classifier, commentary, Piper, SQLite
backend/bin/piper/    Piper binary and en_US-lessac-medium voice
backend/tests/        pytest
frontend/src/         React UI
chessmon_architecture_v2.md
chessmon_coach_commentary.md
```

## Notes

- Cache keys use the **first 4 FEN fields** + analysis settings, so repeated openings are instant.
- One Stockfish process searches one position at a time; the pool avoids friends blocking each other.
- Coach lines are chosen on the server and stored with the review, so reopening a game shows the same comments.
- A missing Piper install or a failed line never blocks the review. The comment still shows as text.
