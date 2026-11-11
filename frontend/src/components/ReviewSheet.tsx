import { Drawer } from 'vaul'
import type { ReactNode } from 'react'

type Tab = 'moves' | 'chapters'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: Tab
  onTab: (tab: Tab) => void
  moves: ReactNode
  chapters: ReactNode
}

/** Mobile bottom sheet for Moves / Moments. Coach stays on the main phone screen. */
export function ReviewSheet({ open, onOpenChange, tab, onTab, moves, chapters }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet-content" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <Drawer.Title className="sheet-title">Review</Drawer.Title>
          <div className="sheet-tabs" role="tablist">
            {(['moves', 'chapters'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`sheet-tab${tab === t ? ' active' : ''}`}
                onClick={() => onTab(t)}
              >
                {t === 'moves' ? 'Moves' : 'Moments'}
              </button>
            ))}
          </div>
          <div className="sheet-body">
            {tab === 'moves' && moves}
            {tab === 'chapters' && chapters}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
