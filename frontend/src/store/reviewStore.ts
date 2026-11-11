import { create } from 'zustand'

export type CoachMood = 'idle' | 'cheer' | 'wince' | 'think'

type ReviewUiState = {
  currentPly: number
  orientation: 'white' | 'black'
  coachOn: boolean
  voiceOn: boolean
  muted: boolean
  volume: number
  coachMood: CoachMood
  reducedMotion: boolean
  plyTimestamps: number[]
  setPly: (ply: number) => void
  setOrientation: (o: 'white' | 'black') => void
  setCoachOn: (on: boolean) => void
  setVoiceOn: (on: boolean) => void
  setMuted: (on: boolean) => void
  setVolume: (v: number) => void
  setCoachMood: (mood: CoachMood) => void
  setReducedMotion: (on: boolean) => void
  /** Returns true when the user is scrubbing too fast for ceremony. */
  recordPlyChange: () => boolean
  resetSession: () => void
}

export const useReviewStore = create<ReviewUiState>((set, get) => ({
  currentPly: 0,
  orientation: 'white',
  coachOn: true,
  voiceOn: false,
  muted: false,
  volume: 0.8,
  coachMood: 'idle',
  reducedMotion: false,
  plyTimestamps: [],
  setPly: (ply) => set({ currentPly: ply }),
  setOrientation: (orientation) => set({ orientation }),
  setCoachOn: (coachOn) => set({ coachOn }),
  setVoiceOn: (voiceOn) => set({ voiceOn }),
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume }),
  setCoachMood: (coachMood) => set({ coachMood }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  recordPlyChange: () => {
    const now = performance.now()
    const next = [...get().plyTimestamps.filter((t) => now - t < 1000), now]
    set({ plyTimestamps: next })
    return next.length > 3
  },
  resetSession: () =>
    set({
      currentPly: 0,
      coachMood: 'idle',
      plyTimestamps: [],
      orientation: 'white',
    }),
}))
