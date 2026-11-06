export type MoveReview = {
  ply: number
  move_number: number
  san: string
  uci: string
  fen_before: string
  fen_after: string
  moved_by_white: boolean
  label: string
  cp_before?: number | null
  cp_after?: number | null
  mate_before?: number | null
  mate_after?: number | null
  win_pct_before?: number | null
  win_pct_after?: number | null
  win_pct_loss?: number | null
  best_move_uci?: string | null
  best_move_san?: string | null
  pv_uci: string[]
  pv_san: string[]
  is_check: boolean
  is_checkmate: boolean
  is_stalemate: boolean
  comment?: string | null
  tags?: string[]
  comment_id?: string | null
  audio_url?: string | null
}

export type PlayerStats = {
  accuracy: number | null
  move_count: number
  counts: Record<string, number>
}

export type GameReview = {
  id: string
  status: string
  title: string
  pgn: string
  headers: Record<string, string>
  starting_fen: string
  moves: MoveReview[]
  white: PlayerStats | null
  black: PlayerStats | null
  settings: Record<string, unknown>
  progress: { current?: number; total?: number }
  error?: string | null
}

export type GameListItem = {
  id: string
  title: string
  status: string
  white_accuracy: number | null
  black_accuracy: number | null
  created_at: string
}

export type SseEvent =
  | { type: 'progress'; current: number; total: number }
  | { type: 'move_result'; move: MoveReview }
  | { type: 'done'; review?: GameReview; message?: string }
  | { type: 'error'; message: string }
