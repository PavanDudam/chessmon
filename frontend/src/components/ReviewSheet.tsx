import { Drawer } from 'vaul'
import type { ReactNode } from 'react'

type Tab = 'moves' | 'chapters' | 'coach'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: Tab
  onTab: (tab: Tab) => void
  moves: ReactNode
  chapters: ReactNode
  coach: ReactNode
}

/** Mobile bottom sheet. Called from Review.tsx below 900px. No prior sheet exists. */
export function ReviewSheet({ open, onOpenChange, tab, onTab, moves, chapters, coach }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet-content" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <Drawer.Title className="sheet-title">Review</Drawer.Title>
          <div className="sheet-tabs" role="tablist">
            {(['moves', 'chapters', 'coach'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`sheet-tab${tab === t ? ' active' : ''}`}
                onClick={() => onTab(t)}
              >
                {t === 'moves' ? 'Moves' : t === 'chapters' ? 'Chapters' : 'Coach'}
              </button>
            ))}
          </div>
          <div className="sheet-body">
            {tab === 'moves' && moves}
            {tab === 'chapters' && chapters}
            {tab === 'coach' && coach}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
