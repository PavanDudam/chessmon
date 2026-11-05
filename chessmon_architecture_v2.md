# chessmon: Architecture, Scope & Learning Plan (v2)

A private web app for reviewing chess games with Stockfish. Runs on your own PC, used by you and your friends. (Working name; final name TBD.)

**What changed from v1:** added a chess data-format cheat sheet, a learning roadmap, resume guidance, a cache-key refinement (first 4 FEN fields), a Python quick-start snippet, and a link to the animated explainer.

---

## 1. What it is

Paste a game (PGN) → the server analyzes every move with Stockfish → you get a move-by-move review with labels (Best, Mistake, Blunder...), an eval bar, an eval graph, and the engine's better move.

- **Goals:** great UX, correct analysis, simple to run and maintain.
- **Non-goals:** public product, scale, monetization.

---

## 2. Architecture

```
   [ Browser: React/Svelte web UI ]
        │  ▲
  (1)   │  │ (4) progress + results (SSE)
  PGN   ▼  │
 ┌──────────────────────────────────────────┐
 │        FastAPI app (runs on your PC)     │
 │                                          │
 │  Job queue (in-memory) ──► Engine pool   │
 │        │                  (2-3 Stockfish │
 │        │                   processes)    │
 │        ▼                       ▲         │
 │  python-chess (PGN parse,      │ UCI     │
 │  legality, FEN)  ──────────────┘         │
 │        │                                 │
 │        ▼                                 │
 │  Classifier (win% math)                  │
 │        │                                 │
 │        ▼                                 │
 │  SQLite (position cache + saved reviews) │
 └──────────────────────────────────────────┘
        ▲
   Tailscale (friends reach it from anywhere)
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React or Svelte | Fast to build, large ecosystem |
| Board | `chessground` or `react-chessboard` | Polished, interactive boards |
| Charts | Recharts / Chart.js / plain SVG | Eval graph |
| Backend | FastAPI (Python) | Async, simple, great with python-chess |
| Chess logic | `python-chess` | PGN parsing, legal moves, FEN, UCI bridge |
| Engine | Stockfish 18 (use the current official release from stockfishchess.org) | Strongest free engine |
| Storage | SQLite | One file, zero setup |
| Live progress | Server-Sent Events (SSE) | Simpler than WebSockets for one-way updates |
| Remote access | Tailscale | Friends reach your PC without hosting |
| Tests | pytest | Known-position tests for the classifier |

---

## 3. Local system requirements (rough estimates)

Stockfish is CPU-bound. No GPU needed.

| | Minimum | Comfortable |
|---|---|---|
| CPU | 4 cores, AVX2 (Intel/AMD) or Apple Silicon/ARM64 | 8+ cores |
| RAM | 8 GB | 16 GB |
| Disk | ~2 GB free | ~5 GB free |
| GPU | Not needed | Not needed |
| OS | Windows / macOS / Linux | Same |

- Each engine process: about 0.5-1.5 GB RAM (hash table + neural net).
- Expected speed: a 40-move game (~80 positions) takes about 1-2 minutes on a decent 4-8 core machine.
- Measure your real speed: run `stockfish bench` in the Stockfish folder.
- Threads per engine = CPU cores ÷ number of engine processes (e.g. 8 cores → 2 engines × 4 threads).
- If slow: analyze each position for a fixed time (~0.5s) instead of a fixed depth.

---

## 4. Chess data formats cheat sheet

> **PGN is the movie. FEN is one photo from the movie. SAN is how humans write a move; UCI is how engines write it. Centipawns are money; mate is game over.**

Animated walkthrough: https://claude.ai/artifact/4fq422rjmRDE5kf6agRWhs

| Concept | What it is | Example |
|---|---|---|
| **PGN** | Whole game: metadata + move list | `1. e4 e5 2. Nf3 Nc6 1-0` |
| **Ply** | One half-turn. 40 turns ≈ 80 plies = ~80 positions to analyze | `1. e4` is ply 1, `e5` is ply 2 |
| **FEN** | One position, 6 space-separated fields | `rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2` |
| **SAN** | Human-readable move (needs position context) | `Nf3`, `exd5`, `O-O`, `e8=Q` |
| **UCI** | Engine move: from-square + to-square | `g1f3`, `e1g1`, `e7e8q` |
| **Centipawn** | 1/100 of a pawn. +100 ≈ one pawn up | `+300` ≈ a knight up |
| **Mate score** | Forced checkmate, not a number | `mate 3`, `mate -2` |

### FEN fields

1. **Pieces**, rank 8 → rank 1, separated by `/`. Uppercase = White, lowercase = Black. A digit = that many empty squares.
2. **Side to move:** `w` or `b`.
3. **Castling rights:** `KQkq` (K/Q = White short/long, k/q = Black short/long, `-` = none).
4. **En passant target square:** e.g. `d6`, or `-`.
5. **Halfmove clock:** plies since last capture or pawn move.
6. **Move number.**

**Cache-key tip:** two identical positions can differ in fields 5 and 6. Key your cache on **the first four fields + depth/time settings**, or you'll miss hits.

### Rules you must be aware of

- **Check / checkmate:** king attacked / no escape. SAN uses `+` and `#`.
- **Stalemate:** no legal move *and not in check* → **draw**, not a win. Easy bug.
- **Castling:** king moves two squares, rook jumps over. SAN `O-O` / `O-O-O`, UCI `e1g1`. FEN field 3 tracks the rights.
- **En passant:** a pawn that just moved two squares can be captured as if it moved one, only on the very next move. FEN field 4 stores the target square.
- **Promotion:** a pawn reaching the last rank becomes a queen/rook/bishop/knight.
- **Draw rules:** threefold repetition, 50-move rule. `python-chess` detects these.

### python-chess quick start

```python
import chess

board = chess.Board()
move = board.parse_san("Nf3")      # SAN → Move
print(move.uci())                  # 'g1f3'
print(board.san(move))             # 'Nf3'
board.push(move)
print(board.fen())                 # FEN after the move

# Stockfish score, always from White's point of view:
# info["score"].white().score(mate_score=10000)
```

---

## 5. Core logic: move classification

Don't classify on raw centipawn loss. One pawn matters a lot in an even game and almost nothing when you're crushing. Convert evals to **win probability**, then classify on the drop.

```
win% = 50 + 50 * (2 / (1 + e^(-0.00368 * cp)) - 1)
```

| Situation | Eval change | Win% change |
|---|---|---|
| Even game | +0.2 → -0.8 | ~52% → ~43% (about -9 points) |
| Already winning | +8.0 → +7.0 | ~95% → ~93% (about -2 points) |

**Rules to get right:**

1. **Side to move.** Stockfish reports from the mover's point of view. Convert everything to White's perspective, then measure the loss for whoever just moved.
2. **Mate scores.** Map "mate in N" to ~100% / ~0% win chance and handle it explicitly. Missing a forced mate is a major blunder.
3. **Book moves.** Opening-theory moves shouldn't be graded by the engine. Label them "Book".
4. **Example thresholds (tune these):** drop in win% of roughly <2 Best/Good, 2-5 Inaccuracy, 5-10 Mistake, >10 Blunder.

**Later labels:**
- **Great** = the only good move (big gap between engine's #1 and #2, needs top 2-3 lines).
- **Brilliant** = a real piece sacrifice that keeps or improves your position, you're not already winning by a mile, and the move isn't obvious.

---

## 6. Build now (v1)

| # | Feature | Why it matters |
|---|---|---|
| 1 | **Import game by pasting PGN** | Works in 5 seconds, nothing to break. No account linking. |
| 2 | **Full-game review** | The whole product. Stockfish on every position. |
| 3 | **Move classification via win%** | Makes the app trustworthy. Handle side-to-move, mate, book. |
| 4 | **Interactive board with move navigation** | Arrow keys, click-a-move. Most-used feature. |
| 5 | **Eval bar + eval graph** | Who's winning and where the game swung. Click graph to jump to move. |
| 6 | **Best-move arrow + better line** | Shows what the engine would have played. This is how people learn. |
| 7 | **Accuracy score per player** | One number per side + counts of each move type. Fun to compare. |
| 8 | **Progress feedback** | "Analyzing move 23 of 80", results fill in live. No frozen spinner. |
| 9 | **Job queue + small engine pool** | Submit → job ID → streamed results. 2-3 engines so friends don't block each other. In-memory queue is enough. |
| 10 | **Cache by FEN (first 4 fields) + depth (SQLite)** | Repeated openings are instant. Saved reviews reopen without re-analysis. |
| 11 | **Basic tests** | Known positions (mate in 1, hanging queen, sign-flip, stalemate). |
| 12 | **Friend access** | Tailscale + responsive UI (most friends will use phones). |

### Suggested build order

1. Stockfish wrapper with python-chess (analyze one position).
2. Win% conversion + classification, with tests.
3. FastAPI endpoint: PGN in, full review out.
4. Basic UI: board, move list, navigation.
5. Eval bar, graph, best-move arrows.
6. Progress streaming, job queue, engine pool.
7. Caching and saved reviews.
8. Tailscale, responsive pass, UX polish.

Steps 1-4 = working app. Steps 5-8 = great app.

### API sketch

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/games` | Submit PGN, returns `job_id` |
| GET | `/api/games/{id}/events` | SSE stream of analysis progress |
| GET | `/api/games/{id}` | Full review (moves, evals, labels, accuracy) |
| GET | `/api/games` | List saved reviews |
| POST | `/api/analyze/position` | Analyze a single FEN (for later analysis board) |

---

## 7. Build later (after v1 works)

| Feature | Notes |
|---|---|
| **Brilliant / Great labels** | Needs top-2/3 move gap and sacrifice detection. |
| **Analysis board / play vs engine** | Move pieces yourself, see live eval. Reuses existing pieces. |
| **Opening names** | Needs an opening database file. |
| **Per-friend stats over time** | Accuracy trends, common mistakes. Needs named profiles. |
| **Import by Chess.com / Lichess username** | Convenience once the core is solid. |
| **Dark mode, sounds, board themes** | Polish pass at the end. |
| **Camera scan of a physical board** | High risk, see below. Only if you still want it. |
| **Docker / VPS deployment** | Only if you want to share beyond friends. |

### Why camera scan waits

Even at 99% accuracy per square, the chance all 64 squares are right is about 0.99^64 ≈ 52%. One wrong square means a wrong position. Real photos also break simple line detection (shadows, glare, patterned tables, tall pieces). If you build it later: you need labeled training images, a measured accuracy target, and a screen where the user can tap to fix wrong squares.

---

## 8. Not needed at all

| Skip | Reason |
|---|---|
| Flutter / native mobile app | Responsive web UI covers phones. |
| Login / auth system | Private Tailscale link is enough. Add a name picker later if you want stats. |
| Payments, subscriptions, ads | It's for friends. |
| Training your own engine or chess AI | Stockfish already does the hard part. |
| Custom neural net for move labels | A formula on win% does the job. |
| Redis / Celery / Kubernetes / load balancers | A handful of users. In-memory queue + SQLite is enough. |
| Microservices | One FastAPI app, one frontend. |
| WebSockets | SSE is simpler for one-way progress updates. |

---

## 9. What you need to learn (in this order)

Learn each topic right before you use it.

| Step | Learn | Then build |
|---|---|---|
| 1 | Python basics, `python-chess`, PGN/FEN/SAN/UCI (section 4) | Script: parse a PGN, print each move as SAN, UCI, and FEN |
| 2 | Stockfish via python-chess, centipawns, mate scores | Get an eval for one position (White's view) |
| 3 | Win% math, side-to-move handling, `pytest` | Classifier with tests |
| 4 | FastAPI, REST basics, `asyncio`, Pydantic | PGN-in, review-out endpoint |
| 5 | HTML/CSS/JS, React (or Svelte), `fetch`, a board library | Board + move list + navigation |
| 6 | SSE (`EventSource`), `asyncio.Queue`, worker pools | Live progress + engine pool |
| 7 | SQLite and basic SQL, caching idea | FEN-keyed cache + saved reviews |
| 8 | Git/GitHub, responsive CSS, Tailscale | Polish + friend access |

**Math needed:** a sigmoid (win%), sign flipping for White/Black, simple averages. No heavy math or ML.

**Rough timeline:** 6-10 weeks part-time if you already know Python; add a few weeks if you're newer to programming. Consider plain JavaScript before React.

---

## 10. Resume value

**Verdict:** a good project, and a great one if you measure and document it. A bare "I wrapped Stockfish in a UI" is average because the idea is common.

**What makes it stand out:**
- **Measure things:** analysis time per game, cache hit rate, engine-pool speedup, test count. Example: "Cut review time from 3 min to 1 min with a 3-engine pool."
- **Explain decisions:** why win% over centipawns, how mate scores and side-to-move are handled, why SSE over WebSockets, why in-memory queue over Redis.
- **Make it public:** README with architecture diagram, tradeoffs, benchmarks, and a short screen recording or demo link.
- **Real users:** "used by N friends" is a legitimate line.
- **Optional boosts:** Brilliant/Great detection, or a deployed version.

---

## 11. Risks & notes

- **Sign errors in eval handling** are the most likely bug. Test them early.
- **Slow analysis** on weak CPUs: use fixed time per position rather than fixed depth.
- **Engine concurrency:** one Stockfish process searches one position at a time. Use the pool; don't share a single process across requests.
- **Naming:** pick your own name before sharing publicly. Don't use "clone of" any commercial product in the name or description.
- **Stockfish version:** download the current official release rather than trusting a version number in old notes.
