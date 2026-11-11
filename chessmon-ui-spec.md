# Chessmon UI Redesign: Implementation Spec

Direction: **dark broadcast**, with fighters, a literal tug-of-war, chapters, a reactive coach, icon move list, and a loading ceremony. Hand this file to your developer or to Claude Code as the single source of truth.

Reference prototype: https://claude.ai/artifact/6jneRSQLQofSs4xeoPXZLW (all six interactions, with sample data).

---

## 0. Principles (read first)

1. **A game review is a story.** Design around tension, swings and the moment the game turned.
2. **Ceremony vs utility.** Go big on a few moments (blunder hit, win-line cross, loading, chapter jump). Keep everything else calm, fast and readable.
3. **The board is sacred.** No effect may hide legal moves, the last move, the check indicator or a move classification.
4. **One memorable thing per screen.** Boldness is spent on the tug-of-war and the blunder hit. Everything else is quiet.
5. **No page scroll on desktop.** The review screen is a fixed HUD. Only the move list scrolls, inside its own panel.
6. **Every motion answers an action or marks an event.** No decorative idle animation except the coach and the rope strain.

## 1. Stack

| Need | Use | Why |
|---|---|---|
| UI choreography, springs, layout animation, drag/sheets | **Motion** (npm `motion`, import from `motion/react`; formerly Framer Motion) | Best DX for React; springs and layout animations are first class |
| Multi-step timed sequences (the blunder hit) | **Motion `animate` sequences**, or **GSAP** timeline if you want frame-accurate scrubbing | Prefer one library; use GSAP only if Motion sequences feel limiting. Check GSAP's current license page before shipping |
| Coach mascot | **Rive** (`@rive-app/react-canvas`) | State machine with inputs (`idle`, `cheer`, `wince`, `think`), tiny files, no frame-by-frame video |
| Sound | **Howler.js** (`howler`) | Sprite sheets, pooling, volume ducking |
| Board | **chessground** (Lichess) or `react-chessboard` with a custom piece set | Chessground is fast and has real move animation hooks |
| Chess logic | `chess.js` | Legal moves, SAN, FEN |
| Engine | Stockfish WASM in a Web Worker (you already have this) | Report per-ply progress for the loader |
| State | `zustand` | Current ply, mode, coach state, mute |
| Styling | CSS variables for tokens (Tailwind optional) | Tokens below must live in one place |
| Charts | Hand-written SVG (timeline, tug-of-war) | Full control; no chart lib needed |

Keep the animation stack to **Motion + Rive + Howler**. Add GSAP only with a reason.

## 2. Design tokens

```css
:root {
  /* color */
  --ink-0: #0E0F12;      /* page */
  --ink-1: #171A20;      /* panels */
  --ink-2: #2A2D33;      /* dark square, borders */
  --ink-3: #3A3E46;      /* light square */
  --text: #F2F0EA;
  --text-dim: #9AA0AA;   /* check contrast on --ink-1 before using for small text */
  --good: #3DD6C3;       /* best, accuracy, white fighter */
  --warn: #FFB020;       /* coach, black fighter, inaccuracy */
  --bad: #FF4D3D;        /* blunder, damage */
  --mistake: #FF8A3D;
  --excellent: #7BE0A4;

  /* type */
  --font-display: 'Bricolage Grotesque', sans-serif; /* 500, 800 */
  --font-mono: 'JetBrains Mono', monospace;          /* moves, numbers */

  /* motion */
  --spring-ui: 180ms;     /* UI springs, snappy */
  --spring-piece: 320ms;  /* pieces, weighty with slight overshoot */
  --freeze: 90ms;         /* hit stop */
}
```

Type scale: 12 / 14 / 17 / 20 / 26 / 40 / 60. Accuracy numbers use 60 / weight 800. Use sentence case for labels (all-caps eyebrow labels read as a generic template).

Motion springs (Motion):

```ts
export const springUI    = { type: 'spring', stiffness: 520, damping: 34 } as const;
export const springPiece = { type: 'spring', stiffness: 380, damping: 18, mass: 0.9 } as const;
export const springRope  = { type: 'spring', stiffness: 220, damping: 12 } as const; // visible overshoot
```

## 3. Layout (desktop, fixed 100dvh, no page scroll)

```
+--------------------------------------------------------------+
| Fighter: White (accuracy HP bar)   | Fighter: Black          |
+--------------+-----------------------------+-----------------+
| eval strip   |          BOARD              | Coach + bubble  |
|              |                             | Chapters (3-5)  |
|              |                             | Move list       |
|              |                             | (own scroll)    |
+--------------+-----------------------------+-----------------+
| TUG-OF-WAR scene (rope, flag, teams, win lines)              |
+--------------------------------------------------------------+
| Eval timeline with chapter markers + transport controls      |
+--------------------------------------------------------------+
```

```css
.review { height: 100dvh; display: grid; gap: 16px; padding: 24px;
  grid-template-rows: auto 1fr auto auto;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); }
.board-wrap { aspect-ratio: 1; height: 100%; max-height: 100%; }  /* board sizes to available height */
.movelist { overflow-y: auto; overscroll-behavior: contain; }
```

Mobile (<900px): board pinned at the top, tug-of-war collapses to a 56px strip, and a bottom sheet (Motion drag or `vaul`) switches between Moves, Chapters and Coach. Timeline sits above the sheet.

## 4. Components

### 4.1 Fighter cards (accuracy as HP)

- Name, rating, side, large accuracy number (60px, 800).
- A 22px **HP bar** shows accuracy; it is the game-long total, so it animates once on load (fill from 0, 700ms, `springUI`).
- Optional live mode: as the user scrubs, show **running accuracy up to the current ply**, so the bar "takes damage" as they step through blunders.
- **Ghost bar:** when damage occurs, the main bar drops immediately and a lighter ghost bar drains after a 400ms delay (the classic fighting-game trailing damage).
- Winner gets a 4px underline in their colour; no crowns or confetti here.

### 4.2 The blunder hit (the signature moment)

Trigger: stepping onto a ply classified **blunder** (not on every jump; skip when the user is scrubbing fast, see "Rate limit" below).

Timeline:

| t (ms) | Event |
|---|---|
| 0 | Piece moves along an arc, `springPiece` (anticipation: 40ms pull-back, then commit) |
| ~320 | Piece lands |
| 320 to 410 | **Freeze** (hit stop): pause piece/UI animations, duck music |
| 410 | Impact sting plays (sound sprite `blunder`) |
| 410 to 690 | Board shake, 5 keyframes, max 7px, decaying |
| 410 to 1010 | Red flash on the destination square (opacity .85 to 0) |
| 410 | HP bar damage + ghost bar (see 4.1) |
| 410 | Floating label "Blunder -7%" rises 18px and fades |
| 410 | Coach state set to `wince`, bubble text updates |
| ~1400 | Coach returns to `idle` |

```ts
import { animate } from 'motion';

export async function blunderHit(refs: { board: HTMLElement; square: HTMLElement; label: HTMLElement }, damagePct: number) {
  await sleep(FREEZE_MS);                                   // hit stop
  playSound('blunder');
  animate(refs.board, { x: [0, -7, 6, -3, 0], y: [0, 3, -3, 1, 0] }, { duration: 0.28 });
  animate(refs.square, { opacity: [0.85, 0] }, { duration: 0.6 });
  animate(refs.label, { opacity: [0, 1], y: [0, -18] }, { duration: 0.4 });
  coach.set('wince');
}
```

**Rate limit:** if the user changes ply more than 3 times in 1 second, skip all ceremony and only update the board. Respect `prefers-reduced-motion`: replace shake and flash with a static red outline and keep the sound optional.

Brilliant / best moves get the mirror image: teal glow on the square, a short rising two-note sound, coach `cheer`. Do this for **brilliant and critical-save moves only**, not every "best", or it becomes noise.

### 4.3 Tug-of-war

Replaces the thin eval bar. A horizontal scene, about 130px tall:

- **Rope** across the full width.
- **Flag** at the rope's centre; its position is the eval.
- **White team** on the left, **Black team** on the right, 3 pieces each, holding the rope; both strain with a tiny looped jitter.
- **Win lines** at 12% and 88%. Crossing one fires the big moment (confetti or sting, coach cheers).
- **Leaning:** the side ahead leans back more, the loser less and is dragged forward.
- **Overshoot:** use `springRope` so a blunder yanks past the target and settles.

Mapping (use win probability, not raw centipawns, so it feels fair in lopsided positions):

```ts
// Lichess-style win probability, white's perspective, 0..100
export const whiteWin = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

// flag position as % of scene width. White winning moves flag LEFT.
export const flagPct = (cp: number) => 88 - 76 * (whiteWin(cp) / 100);

// lean in degrees for each team (advantage = -1..1, positive favours white)
const adv = (whiteWin(cp) - 50) / 50;
const leanWhite = -6 - Math.max(0, adv) * 18;   // rotate, origin bottom centre
const leanBlack =  6 + Math.max(0, -adv) * 18;
```

Mate scores: clamp to a mate cap (for example +/- 10 pawns worth) before mapping.

Implementation notes:
- Drive `left` and `rotate` for flag and teams with Motion `animate` or `useSpring` (not CSS transitions) so springs stay consistent.
- Pieces for now are chess glyphs. Replace with illustrated characters in your final art style (see section 8).
- Accessibility: wrap the scene in `role="img"` with a live-updating `aria-label` ("White is ahead by 1.2"), and show the numeric eval as text beside it.

### 4.4 Turning points as chapters

Concept: like YouTube chapters for a game. The app finds where the game swung or changed phase, names those moments and lists them as jump-to items, so no one has to click through 40 moves.

Detection (runs once after analysis):

```ts
type Ply = { i: number; cp: number; cls: Classification; isBook: boolean };
type Chapter = { startPly: number; endPly: number; title: string; swing: number; kind: 'opening'|'swing'|'phase'|'conversion' };

function buildChapters(plies: Ply[], opts = { swingPct: 15, minGap: 4 }): Chapter[] {
  const win = plies.map(p => whiteWin(p.cp));
  const points: number[] = [];
  for (let i = 1; i < plies.length; i++) {
    if (Math.abs(win[i] - win[i - 1]) >= opts.swingPct) points.push(i);
  }
  // merge points closer than minGap plies, keeping the largest swing
  // add boundaries: end of book (opening), first time |win-50| > 40 (conversion)
  // each chapter spans from one boundary to the next
  return [];
}
```

Naming (deterministic templates first; an LLM pass is optional later):
- Blunder by X: "{Player} drops the centre" / "{Player} hangs a piece" based on whether material changed.
- Lead flips: "The lead changes hands".
- Mate appears: "Mate in {n} on the board".
- Opening: "Opening" for book moves.
- Quiet middle: "Scramble".

UI: 3 to 5 cards in the right panel (title, ply range, swing value colour-coded). Also render the same chapters as **markers on the timeline**. Click or tap jumps the board, the tug-of-war and the move list, with `springUI`. Cap at 5 chapters so the list never needs scroll.

### 4.5 Coach

Rive file with one state machine, `CoachSM`:

| Input | Type | Effect |
|---|---|---|
| `mood` | number: 0 idle, 1 cheer, 2 wince, 3 think | selects the state |
| `talk` | boolean | mouth moves while a voice line plays |
| `blink` | trigger | fired randomly every 3 to 6s while idle |

Behaviour rules:
- Speak **only on swings, brilliant moves and chapter changes**. Routine moves stay silent, which keeps the coach special.
- Bubble text types out at about 40 chars/s, interruptible by the next ply.
- Voice line plays through the existing TTS, **ducks board sounds by 6 dB** while speaking.
- Mute and volume controls live in the coach panel header.

Personality modes (a setting; same analysis, different phrasing tables): hype caster, calm sensei, friendly trash-talker.

Memory (later phase): track recurring mistake tags across saved reviews ("dropped a knight to a fork", "weakened the king") and surface them, for example: "That is the third game you've hung a piece to a fork."

Idle life: blink, glance at the board, nod off after 20s of no input.

### 4.6 Move list with icons

Two columns (White, Black), with ply number on the left. Each move has a **shape-coded icon** (not colour alone), and a delta for bad moves.

| Class | Icon | Colour | Show delta |
|---|---|---|---|
| Brilliant | double star | `--good` | no |
| Best | star | `--good` | no |
| Excellent | check | `--excellent` | no |
| Good | dot | `--text-dim` | no |
| Book | "B" badge | grey | no |
| Inaccuracy | `?!` | `--warn` | yes |
| Mistake | `?` | `--mistake` | yes |
| Blunder | `??` | `--bad` | yes (win% lost) |

Rules:
- Consecutive book moves **collapse into one row** ("Book: e4 c5 d4"), tap to expand.
- Current move is highlighted and auto-scrolled into view (`scrollIntoView({block:'nearest'})`).
- Keyboard: left/right arrows move one ply; Home/End jump to start/end; `[` and `]` jump between chapters.
- Make icons SVG, 22px, inside a 44px minimum tap target on touch.
- Also show the same icon as a **badge on the destination square** on the board.

### 4.7 Loading ceremony

Drive it with **real** per-ply progress from the Stockfish worker; do not fake timing. If analysis finishes in under 1.5s, still play a minimum 1.5s stagger so it reads as a moment.

- Row of N ticks (one per ply). Each lights as that ply is analysed; blunders turn red as found.
- The eval graph draws itself live, one point per analysed ply.
- Coach in `think`; lines change at milestones ("Looking for the first swing...", "Found a blunder, checking the damage...").
- Counter: "Analysing move 12 / 40".
- On completion: coach `cheer`, ticks collapse into the timeline, and the screen transitions into the review (shared-element transition via Motion `layoutId`).
- Provide a visible Cancel.

### 4.8 Home / import

- Hero is **Import**: paste a Chess.com or Lichess game link or username, or drop a PGN file. Keep the paste-PGN textarea as a secondary option.
- Saved reviews as cards: mini final-position board, eval sparkline, two accuracy rings, result, date.
- Later: a "recurring mistakes" strip once 3+ reviews exist.

## 5. Sound design

| Event | Sound |
|---|---|
| Move | short wooden tick |
| Capture | thud |
| Check | rising two-note |
| Blunder | low sting (plays after the freeze) |
| Brilliant | bright rising sting |
| Chapter jump | soft whoosh |
| Win-line cross | short fanfare |

Ship as one audio sprite via Howler. Default volume low; remember mute and volume per user; never autoplay before a user gesture.

## 6. Performance and accessibility (non-negotiable)

- Animate only `transform` and `opacity`. Budget: 60fps on a mid-range Android phone. Test on one.
- `prefers-reduced-motion`: disable shake, flash, rope jitter and overshoot; keep state changes instant and keep colour/icon feedback.
- Contrast 4.5:1 for all text (including the dim grey); verify `--text-dim` on `--ink-1`.
- Visible keyboard focus on every control; real `<button>` elements.
- Do not rely on colour alone: icons differ by shape.
- Live region (`aria-live="polite"`) for the coach bubble.
- Sound is never the only feedback.

## 7. Build order (each step has an acceptance test)

1. **Tokens + static layout** in code. Accept: fills 100dvh with no page scroll at 1280x720 and 1920x1080.
2. **Board + move classification badges + move list.** Accept: arrow-key navigation, auto-scroll, correct icons.
3. **Tug-of-war + eval mapping.** Accept: scrubbing moves the flag smoothly with visible overshoot on blunders.
4. **Blunder hit sequence** end to end, with sound. Accept: timeline in 4.2 matches within 30ms; rate limit works.
5. **Fighter cards + ghost bar.**
6. **Chapters** (detection, cards, timeline markers). Accept: a 40-move game yields 3 to 5 sensible chapters.
7. **Coach in Rive** wired to events.
8. **Loading ceremony** on real engine progress.
9. **Home / import redesign.**
10. **Mobile layout + bottom sheet.**
11. Polish: reduced motion, contrast pass, real-device performance test, 3 to 5 user tests (watch where people hesitate).

## 8. Art to commission or generate

- **Pieces and board theme:** a custom piece set carries most of the personality.
- **Tug-of-war characters:** 2 teams of 3, with effort faces (gritted teeth when losing, grin when winning). Export as Rive or SVG rigs.
- **Coach mascot:** a rook character, Rive state machine with 4 moods.
- Lock one style reference (for example Midjourney `--sref`) so all creatures look related. Keep the art style consistent with the tokens above.

## 9. Skills to use (and how to use them like a pro)

**Skills for Claude (what builds this):**
- **`frontend-design` skill:** guides distinctive, non-template UI (it flags the usual generated-design tells). In Claude.ai it's available in the file-creation environment; in Claude Code you can add it as a project skill.
- **Custom project skill:** use the skill-creator to turn this spec into a `chessmon-ui` skill so every session follows the same tokens, motion springs and ban list.
- **`CLAUDE.md` in your repo:** put sections 0, 2, 6 and the ban list below at the top so every Claude Code session inherits them.

**Skills you need on the team (human):**
- Motion design and "game feel" (anticipation, hit stop, overshoot, easing).
- Rive state machines.
- Sound design for UI.
- Performance profiling (Chrome Performance panel, React Profiler).

**Prompt template for each task (paste into Claude Code or Claude):**

```
Read DESIGN.md (this file). Implement section 4.X only.
Use Motion + the springs in section 2. Animate only transform/opacity.
Respect prefers-reduced-motion. Use tokens, no hard-coded colours.
Do not add libraries. Show me the diff and how to test the acceptance criterion.
```

**Ban list (put in every prompt):** no purple or blue gradients, no glassmorphism, no identical rounded-card grids, no emoji as icons, no Inter, no fade-up-on-scroll on every section, no all-caps eyebrow labels, no lorem ipsum (use real game data).

**Workflow tips:**
- One component per prompt; judge motion in the browser, not in screenshots.
- Keep a `/sandbox` route with a "Play blunder", "Jump to chapter" and "Replay loading" button so you can tune timing quickly.
- Expose timing constants in one file (`motion.config.ts`) and tune with real playtesters.
- Record a screen capture of each ceremony and compare frame by frame against the table in 4.2.
