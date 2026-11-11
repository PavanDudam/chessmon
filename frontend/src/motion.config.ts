export const FREEZE_MS = 90

export const springUI = { type: 'spring', stiffness: 520, damping: 34 } as const
export const springPiece = { type: 'spring', stiffness: 380, damping: 18, mass: 0.9 } as const
export const springRope = { type: 'spring', stiffness: 220, damping: 12 } as const

export const BLUNDER_RATE_LIMIT = { windowMs: 1000, maxChanges: 3 } as const
