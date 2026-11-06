# chessmon: Coach Commentary Feature (Template Method)

A character shows a short speech bubble for every move in the review: the grade, the eval, and a friendly one-sentence comment. This document covers the template-based approach (Method 1), which is free, instant, offline, and predictable.

> Status: design document. Code samples are sketches that have not been run. Test them on a few moves before relying on them.

---

## 1. Goal and scope

**Goal:** for each ply in a finished review, produce a comment that is correct, varied, and in the mascot's voice.

**In scope (v1.1):**
- Facts detected with python-chess, one sentence per move, stored with the review.
- A mascot and speech bubble in the UI with a coach on/off toggle.
- Voice: each comment is spoken using Piper, an offline voice that runs on your PC (section 8a). Added after the text version works.

**Out of scope for now:**
- AI-generated comments (see section 10).
- Browser text-to-speech (unreliable, especially on Linux).
- Deep tactical explanations ("this forks your rook and king").

**Do this after:** the checkmate graph fix, the stalemate test, and the benchmarks. Measured results matter more for your resume than this feature.

---

## 2. Why templates first

| | Templates (this doc) | AI model (later, optional) |
|---|---|---|
| Cost | Free | Money per game |
| Speed | Instant | Network delay |
| Offline | Yes | No |
| Accuracy | Only says what code detected | Can say wrong things about the position |
| Variety | Limited by lines you write | Natural and varied |
| Setup | None | API key, error handling |

---

## 3. Architecture

```
 Existing review pipeline (already built)
 ┌───────────────────────────────────────────────┐
 │ PGN → engine pool → evals → classifier →      │
 │ grade per move (Book/Best/.../Blunder)        │
 └───────────────────────┬───────────────────────┘
                         │ for each ply: board before, move, grade, best move
                         ▼
 ┌───────────────────────────────────────────────┐
 │ Commentary module (new)                       │
 │                                               │
 │  1. move_facts()  → tags + slots              │
 │  2. pick pool     → grade + highest tag       │
 │  3. fill template → seeded random choice      │
 └───────────────────────┬───────────────────────┘
                         │ comment text
                         ▼
 SQLite: store comment with each move  ──►  API returns it  ──►  UI speech bubble
                         │
                         ▼
 Voice module (Piper, runs on your PC)
   speakable text ──► WAV file, cached by hash ──► data/audio/
                         │
                         ▼
 API sends audio_url per move ──► browser plays <audio> when that move is shown
```

**Key decision:** generate comments on the server when the review is built and store them. The frontend only displays text. Reopening a saved game needs no recomputation.

---

## 4. Data changes

**Per-move record** gets one new field:

| Field | Type | Example |
|---|---|---|
| `comment` | text | "Oh no! Your queen on h4 can be taken for free. Nc6 was the move." |
| `audio_url` | text, nullable | `/audio/3f9a1c2b7d4e8a10.wav` (empty until the file is ready) |

Optional extras worth storing for the UI and debugging:
- `tags`: the detected facts, e.g. `["hangs_piece"]`
- `comment_id`: which template line was used

**API:** the existing review response includes `comment` and `audio_url` in each move object. The only new route is a static one that serves the `data/audio/` folder at `/audio/...`.

---

## 5. Step 1: detect facts about the move

For each move, collect:

- **Slots** (words to fill in): SAN, piece name, destination square, captured piece, best move in SAN.
- **Tags** (situations): `capture`, `check`, `castle`, `promo`, `develops`, `hangs_piece`, `mate`.

```python
import chess

def move_facts(board, move, best_uci):
    mover = board.turn
    piece = board.piece_at(move.from_square)
    facts = {
        "san": board.san(move),
        "piece": chess.piece_name(piece.piece_type),      # "queen"
        "to": chess.square_name(move.to_square),          # "h4"
        "best": board.san(chess.Move.from_uci(best_uci)) if best_uci else "",
        "tags": [],
    }
    tags = facts["tags"]

    if board.is_capture(move):
        facts["captured"] = ("pawn" if board.is_en_passant(move)
                             else chess.piece_name(board.piece_at(move.to_square).piece_type))
        tags.append("capture")
    if board.is_castling(move):
        tags.append("castle")
    if move.promotion:
        tags.append("promo")
    if board.gives_check(move):
        tags.append("check")

    back_rank = 0 if mover == chess.WHITE else 7
    if (board.fullmove_number <= 10
            and piece.piece_type in (chess.KNIGHT, chess.BISHOP)
            and chess.square_rank(move.from_square) == back_rank):
        tags.append("develops")

    board.push(move)                                      # inspect the position after the move
    if board.is_checkmate():
        tags.append("mate")
    if (piece.piece_type != chess.PAWN
            and board.is_attacked_by(board.turn, move.to_square)       # opponent attacks it
            and not board.is_attacked_by(mover, move.to_square)):      # nobody defends it
        tags.append("hangs_piece")
    board.pop()
    return facts
```

---

## 6. Step 2 and 3: pick a pool, fill the template

Each grade has pools keyed by tag, plus a `default`. A priority order decides which tag wins when several apply.

```python
import random
from collections import defaultdict

PRIORITY = ["mate", "hangs_piece", "promo", "castle", "check", "capture", "develops", "default"]

LINES = {
  "Best": {
    "capture": ["{san} wins the {captured}. Exactly what the engine wanted!"],
    "check":   ["{san} with check. Strong and accurate."],
    "default": ["{san} is the best move here. Nicely spotted!"],
  },
  "Blunder": {
    "hangs_piece": ["Oh no! Your {piece} on {to} can be taken for free. {best} was the move."],
    "default":     ["{san} throws the advantage away. {best} was much better."],
  },
  # Excellent, Good, Inaccuracy, Mistake, Book: same structure
}

def comment(grade, facts, game_id, ply):
    pool = LINES.get(grade, {})
    for tag in PRIORITY:
        if (tag in facts["tags"] or tag == "default") and tag in pool:
            rng = random.Random(f"{game_id}:{ply}")          # same move, same line on reload
            return rng.choice(pool[tag]).format_map(defaultdict(str, facts))
    return ""
```

---

## 7. Worked examples

**Blunder (from the test data): 1. e4 e5 2. Nf3 Qh4?**

| Step | Result |
|---|---|
| Grade | Blunder |
| Facts | piece `queen`, to `h4`, tags `["hangs_piece"]` |
| Best move | `Nc6` |
| Pool | `Blunder` → `hangs_piece` |
| Output | "Oh no! Your queen on h4 can be taken for free. Nc6 was the move." |

**Best (Opera Game): 16. Qb8+**

| Step | Result |
|---|---|
| Grade | Best |
| Tags | `["check"]` |
| Output | "Qb8+ with check. Strong and accurate." |

---

## 8. UI notes

- Mascot image on the left of the board, speech bubble beside it, updating when the user steps through moves.
- Show the grade icon and eval chip inside or next to the bubble.
- Typewriter effect is optional; instant text is fine and better for fast stepping.
- A **Coach on/off** toggle, remembered in the browser.
- On phones, put the bubble above the board and keep it to two lines.
- Book moves can use short lines or no bubble at all.

---

## 8a. Voice (Piper, server-side)

**Why server-side:** browser text-to-speech depends on voices installed on each device, and it failed on Linux. A voice generated on your PC becomes a normal audio file, so it plays on any browser or phone (including friends over Tailscale) with nothing to install.

**Flow:**
1. A comment is created (section 6).
2. The comment is converted to speakable text (see below).
3. Piper turns it into a WAV file, saved as `data/audio/<hash>.wav`.
4. The API returns `audio_url` for that move.
5. The page plays it with an `<audio>` element when the user steps to the move.

**Cache by hash.** Many moves produce the same sentence ("Qb8+ with check. Strong and accurate."). Name the file by a hash of the voice model name plus the spoken text. A line is generated once and reused by every game, so most lines are already cached after a few reviews. Including the model name means switching voices never plays stale audio.

**Make text speakable first.** A voice will read chess notation badly ("Qb8+" or "O-O-O"). Convert before synthesizing:

| Written | Spoken |
|---|---|
| `Qb8+` | "queen b8, check" |
| `Rd8#` | "rook d8, checkmate" |
| `O-O` / `O-O-O` | "castles short" / "castles long" |
| `exd6` | "e takes d6" |
| `a8=Q` | "a8, promotes to queen" |

Keep the written text for the bubble and the spoken text for the voice. They can differ.

**Sketch (not run; check Piper's README for the command for your version):**

```python
import hashlib, subprocess, threading
from pathlib import Path

AUDIO_DIR = Path("data/audio")
MODEL = "en_US-lessac-medium"        # example name; choose your own voice
_locks = {}

def audio_for(text: str) -> str:
    spoken = speakable(text)         # your SAN-to-words function
    key = hashlib.sha1(f"{MODEL}|{spoken}".encode()).hexdigest()[:16]
    path = AUDIO_DIR / f"{key}.wav"
    lock = _locks.setdefault(key, threading.Lock())
    with lock:                       # avoid generating the same line twice at once
        if not path.exists():
            tmp = path.with_suffix(".tmp")
            # Piper's command-line flags differ between versions: use the README.
            subprocess.run(PIPER_COMMAND + ["--output_file", str(tmp)],
                           input=spoken.encode(), check=True)
            tmp.replace(path)        # rename only when complete, so no half-written files
    return f"/audio/{key}.wav"
```

**When to generate:** after the review finishes, in a background worker, so the review appears immediately and audio fills in over the next several seconds. Run it outside the main request loop so it never blocks other users.

**Performance:** short sentences should synthesize quickly on a normal CPU, but this is unmeasured. Time 10 lines on your machine before deciding on background vs on-demand.

**Browser rules:**
- Browsers block sound until the user has clicked something on the page. A visible "Voice on" button satisfies this.
- Provide mute and volume controls, remembered in the browser.
- Stop the current clip when the user steps to another move so lines never overlap.
- If a file is not ready yet, show the text and skip the voice without an error.

**Setup notes:**
- Install Piper and one English voice by following its README, since install steps and flags change between versions.
- Check the license of the voice model before sharing the app publicly. Friends-only use is simple; a public repo needs the license checked.
- Use one voice everywhere so the mascot sounds consistent.
- WAV files are large. For hundreds of short lines it is fine, and ffmpeg can convert to a smaller format if disk space matters.

**Other options considered:**

| Option | Pros | Cons |
|---|---|---|
| Piper on your server (chosen) | Free, offline, natural, works on every device | Setup, some CPU, a cache folder |
| Browser voices | No setup | Depends on each device. Failed on your Linux machine. |
| Cloud text-to-speech | Very natural | Costs money, needs internet and a key |
| Human recording | Best personality | Cannot cover filled-in slots like `{piece}` and `{to}` |

---

## 9. Things to know

1. **Only say what you detected.** If a line says "you threaten the queen", the code must have checked it. A wrong comment hurts trust more than a plain one.
2. **Priority order matters.** A tag only wins if the grade's pool has a line for it. Decide deliberately which tags each grade supports.
3. **Seeded random choice** (game id + ply) keeps the same line when someone reopens a saved review. Plain `random.choice` would change it every time.
4. **Generate on the server and store it.** The frontend should not run chess logic.
5. **Writing is the real work.** Aim for 3-5 variants per common grade and tag combination, about 100 lines total, in one consistent mascot voice.
6. **Limits of the sketch:**
   - `hangs_piece` only checks the piece that just moved, not other pieces left loose.
   - It cannot see sacrifices, so Brilliant lines ("clever sacrifice!") need extra logic later.
   - "Develops" is a simple rule (knight or bishop leaving its home rank early) and will occasionally be wrong.
7. **Original character and wording.** Do not reuse another app's mascot, artwork, or exact comment text. Create your own mascot and write your own lines.
8. **Keep lines short and kind.** Friends will read hundreds of these. One sentence, no jargon-heavy explanations, no mocking blunders.
9. **Mate and game-over positions:** handle them before asking for a best move, since there may be none (checkmate, stalemate).
10. **Perspective:** write lines from the mover's point of view ("your queen") and check the player's side before choosing second-person wording, since you are reviewing both players.
11. **Voice files are cached forever by hash.** If you change the mascot's voice or the speakable-text rules, the hash changes automatically, but old files stay on disk. Delete `data/audio/` occasionally to clean up.
12. **Voice is optional.** The app must work fully with text only, so a missing Piper install or a failed synthesis never breaks a review.

---

## 10. Later upgrades (not now)

- More detectors: missed mate, missed free piece, opponent can now fork, trapped piece, back-rank weakness.
- Brilliant/Great lines, once those grades exist.
- Opening names in Book comments, if you add an opening database.
- Optional AI-written comments behind a setting, using the same facts as input. Needs an API key, costs money, and must be checked for wrong statements.
- Per-friend mascot names or tones.

---

## 11. Build order

1. Write `move_facts` and test it on 10 hand-picked moves (capture, check, castle, en passant, promotion, hanging piece, mate).
2. Write 1-2 lines per grade, wire up `comment`, and print results for a full game in the terminal.
3. Add the `comment` field to the database and API.
4. Build the bubble UI with the on/off toggle.
5. Expand the line pools to 3-5 variants per case.
6. Install Piper, generate one test sentence from the terminal, and time it.
7. Write `speakable()` and `audio_for()`, add the `/audio` static route and the `audio_url` field.
8. Add the play button, mute, volume, and the "Voice on" click for browser autoplay rules. Generate audio in a background worker.
9. Test: the same game reopened shows identical comments, mate and stalemate positions do not crash, voice failures fall back to text, and phone layout fits.

---

## 12. Test ideas

| Case | Expected |
|---|---|
| 2...Qh4 after 1. e4 e5 2. Nf3 | Blunder line mentioning the queen on h4 |
| 16. Qb8+ in the Opera Game | Best line with check |
| 17. Rd8# | Mate line, no best move needed |
| En passant capture (exd6) | Captured piece named "pawn" |
| Castling | Castle line, no crash |
| Promotion | Promo line, no crash |
| Stalemate final position | No engine move, no crash, no win/loss wording |
| Reopen a saved game | Identical comments as the first time |
| Same sentence in two games | One audio file, reused (check the cache folder) |
| `Qb8+`, `Rd8#`, `O-O-O`, `exd6` | Spoken as words, not letters and symbols |
| Piper missing or failing | Review still opens, text shows, no error to the user |
| Step quickly through moves | Only one clip plays at a time |
| First visit, no click yet | No autoplay error; "Voice on" button visible |
| Phone over Tailscale | Audio plays |
