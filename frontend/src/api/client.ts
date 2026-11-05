import type { GameListItem, GameReview, SseEvent } from '../types'

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string') return data.detail
    return JSON.stringify(data?.detail ?? data)
  } catch {
    return res.statusText || 'Request failed'
  }
}

export async function createGame(
  pgn: string,
  opts?: { movetime_ms?: number; depth?: number },
): Promise<string> {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn, ...opts }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json()
  return data.job_id as string
}

export async function getGame(id: string): Promise<GameReview> {
  const res = await fetch(`/api/games/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function listGames(): Promise<GameListItem[]> {
  const res = await fetch('/api/games')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function subscribeGameEvents(
  id: string,
  onEvent: (event: SseEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const source = new EventSource(`/api/games/${id}/events`)
  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as SseEvent
      onEvent(data)
    } catch {
      // ignore malformed
    }
  }
  source.onerror = (err) => {
    onError?.(err)
  }
  return () => source.close()
}
