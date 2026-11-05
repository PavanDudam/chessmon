import type { PlayerStats } from '../types'

type Props = {
  whiteName: string
  blackName: string
  white: PlayerStats | null
  black: PlayerStats | null
}

function Side({
  name,
  color,
  stats,
}: {
  name: string
  color: 'white' | 'black'
  stats: PlayerStats | null
}) {
  const accuracy = stats?.accuracy
  const counts = stats?.counts ?? {}
  return (
    <div className={`accuracy-side ${color}`}>
      <div className="accuracy-head">
        <strong>{name}</strong>
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

export function AccuracySummary({ whiteName, blackName, white, black }: Props) {
  return (
    <div className="accuracy-summary">
      <Side name={whiteName} color="white" stats={white} />
      <Side name={blackName} color="black" stats={black} />
    </div>
  )
}
