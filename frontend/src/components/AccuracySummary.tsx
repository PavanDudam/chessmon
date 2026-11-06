import type { PlayerStats } from '../types'

type Props = {
  whiteName: string
  blackName: string
  whiteRating?: string | null
  blackRating?: string | null
  white: PlayerStats | null
  black: PlayerStats | null
}

function Side({
  name,
  rating,
  color,
  stats,
}: {
  name: string
  rating?: string | null
  color: 'white' | 'black'
  stats: PlayerStats | null
}) {
  const accuracy = stats?.accuracy
  const counts = stats?.counts ?? {}
  return (
    <div className={`accuracy-side ${color}`}>
      <div className="accuracy-head">
        <strong>
          {name}
          {rating ? <span className="player-rating">{rating}</span> : null}
        </strong>
        <span className="accuracy-score">
          {accuracy == null ? '—' : `${accuracy.toFixed(1)}%`}
        </span>
      </div>
      <div className="accuracy-counts">
        {Object.entries(counts).map(([label, n]) =>
          n > 0 ? (
            <span key={label} className={`chip label-${label.toLowerCase()}`}>
              {label} {n}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

export function AccuracySummary({
  whiteName,
  blackName,
  whiteRating,
  blackRating,
  white,
  black,
}: Props) {
  return (
    <div className="accuracy-summary">
      <Side name={whiteName} rating={whiteRating} color="white" stats={white} />
      <Side name={blackName} rating={blackRating} color="black" stats={black} />
    </div>
  )
}
