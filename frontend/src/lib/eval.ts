import type { MoveReview } from '../types'

/** Format White-perspective CP / mate for display. */
export function formatEval(cp?: number | null, mate?: number | null): string {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  if (cp == null) return '—'
  const pawns = cp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`
}

/** Lichess-style white win probability from centipawns, 0..100. */
export function whiteWinFromCp(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** Flag position as % of scene width. White winning moves flag LEFT. */
export function flagPctFromWin(whiteWinPct: number): number {
  return 88 - 76 * (Math.max(0, Math.min(100, whiteWinPct)) / 100)
}

/** Cap mate scores before mapping (~10 pawns). */
export function cappedCp(cp?: number | null, mate?: number | null): number {
  if (mate != null) return mate > 0 ? 1000 : -1000
  if (cp == null) return 0
  return Math.max(-1000, Math.min(1000, cp))
}

export function pointEvalPawns(move: {
  is_checkmate?: boolean
  is_stalemate?: boolean
  mate_after?: number | null
  cp_after?: number | null
  moved_by_white?: boolean
}): number {
  if (move.is_checkmate) return move.moved_by_white ? 10 : -10
  if (move.is_stalemate) return 0
  if (move.mate_after != null) return move.mate_after > 0 ? 10 : -10
  const cp = move.cp_after ?? 0
  return Math.max(-10, Math.min(10, cp / 100))
}

/** Approximate running accuracy up to ply (non-book moves), matching backend formula. */
export function runningAccuracy(moves: MoveReview[], upToPly: number, forWhite: boolean): number | null {
  const scored: number[] = []
  for (const m of moves) {
    if (m.ply > upToPly) break
    if (m.moved_by_white !== forWhite) continue
    if (m.label === 'Book') continue
    const loss = m.win_pct_loss ?? 0
    scored.push(Math.max(0, Math.min(100, 100 * 0.95 ** loss)))
  }
  if (scored.length === 0) return null
  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
}

export function lastToSquare(uci?: string | null): string | null {
  if (!uci || uci.length < 4) return null
  return uci.slice(2, 4)
}

export function gameWinner(headers: Record<string, string>): 'white' | 'black' | 'draw' | null {
  const result = headers.Result
  if (result === '1-0') return 'white'
  if (result === '0-1') return 'black'
  if (result === '1/2-1/2') return 'draw'
  return null
}
