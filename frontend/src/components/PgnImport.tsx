import { useState } from 'react'
import type { FormEvent } from 'react'

type Props = {
  onSubmit: (pgn: string) => Promise<void> | void
  busy?: boolean
}

const SAMPLE = `[Event "Casual Game"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`

export function PgnImport({ onSubmit, busy }: Props) {
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = pgn.trim()
    if (!trimmed) {
      setError('Paste a PGN to analyze.')
      return
    }
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
    }
  }

  return (
    <form className="pgn-import" onSubmit={handleSubmit}>
      <label htmlFor="pgn">Paste PGN</label>
      <textarea
        id="pgn"
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        placeholder="1. e4 e5 2. Nf3 ..."
        rows={12}
        spellCheck={false}
        disabled={busy}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="pgn-actions">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Starting…' : 'Analyze game'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => setPgn(SAMPLE)}
        >
          Load sample
        </button>
      </div>
    </form>
  )
}
