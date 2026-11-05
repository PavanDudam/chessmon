import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import type { MoveReview } from '../types'

type Props = {
  moves: MoveReview[]
  currentPly: number
  onSelect: (ply: number) => void
}

function pointEval(move: MoveReview): number {
  if (move.is_checkmate) {
    // Side that just moved delivered mate → White POV
    return move.moved_by_white ? 10 : -10
  }
  if (move.is_stalemate) {
    return 0
  }
  if (move.mate_after != null) {
    return move.mate_after > 0 ? 10 : -10
  }
  const cp = move.cp_after ?? 0
  return Math.max(-10, Math.min(10, cp / 100))
}

export function EvalGraph({ moves, currentPly, onSelect }: Props) {
  const data = [
    { ply: 0, eval: 0, label: 'Start' },
    ...moves.map((m) => ({
      ply: m.ply,
      eval: pointEval(m),
      label: `${m.move_number}${m.moved_by_white ? '.' : '...'} ${m.san}`,
    })),
  ]

  return (
    <div className="eval-graph">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart
          data={data}
          onClick={(state) => {
            const payload = (state as { activePayload?: Array<{ payload?: { ply?: number } }> })
              ?.activePayload?.[0]?.payload
            const ply = payload?.ply
            if (typeof ply === 'number') onSelect(ply)
          }}
        >
          <XAxis dataKey="ply" hide />
          <YAxis domain={[-10, 10]} hide />
          <ReferenceLine y={0} stroke="#9aa3a0" strokeDasharray="3 3" />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number' ? value.toFixed(2) : String(value ?? ''),
              'Eval',
            ]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
          />
          <Line
            type="monotone"
            dataKey="eval"
            stroke="#2f6b4f"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              const active = payload?.ply === currentPly
              return (
                <circle
                  key={payload?.ply}
                  cx={cx}
                  cy={cy}
                  r={active ? 4 : 2}
                  fill={active ? '#c45c26' : '#2f6b4f'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect(payload.ply)}
                />
              )
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
