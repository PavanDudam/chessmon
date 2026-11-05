type Props = {
  /** White win percent 0-100, or null while loading */
  whiteWinPct: number | null
  cp?: number | null
  mate?: number | null
}

/** Format White-perspective CP / mate for display. */
export function formatEval(cp?: number | null, mate?: number | null): string {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  if (cp == null) return '—'
  const pawns = cp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`
}

export function EvalBar({ whiteWinPct, cp, mate }: Props) {
  const pct = whiteWinPct == null ? 50 : Math.max(2, Math.min(98, whiteWinPct))
  let text = '0.0'
  if (mate != null) {
    text = mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  } else if (cp != null) {
    text = formatEval(cp, null)
  }

  return (
    <div className="eval-bar" aria-label={`Evaluation ${text}`}>
      <div className="eval-bar-fill white" style={{ height: `${pct}%` }} />
      <div className="eval-bar-fill black" style={{ height: `${100 - pct}%` }} />
      <span className="eval-bar-label">{text}</span>
    </div>
  )
}
