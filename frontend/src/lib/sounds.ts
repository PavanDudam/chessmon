import { Howl } from 'howler'

let boardGain = 1
let muted = false
let primed = false

/** Procedural short beeps via data URIs — no external sprite file required. */
function toneDataUri(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 0.35): string {
  const sampleRate = 22050
  const samples = Math.floor((sampleRate * durationMs) / 1000)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const env = Math.min(1, i / 80) * Math.max(0, 1 - i / samples)
    let sample = 0
    if (type === 'square') sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1
    else if (type === 'triangle') {
      const phase = (freq * t) % 1
      sample = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4
    } else sample = Math.sin(2 * Math.PI * freq * t)
    view.setInt16(44 + i * 2, sample * env * volume * 32767, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(binary)}`
}

const SPRITES = {
  move: toneDataUri(880, 40, 'triangle', 0.22),
  capture: toneDataUri(180, 90, 'square', 0.28),
  check: toneDataUri(660, 70, 'sine', 0.3),
  blunder: toneDataUri(110, 220, 'square', 0.4),
  brilliant: toneDataUri(990, 120, 'sine', 0.32),
  chapter: toneDataUri(440, 80, 'triangle', 0.2),
  winline: toneDataUri(523, 180, 'sine', 0.35),
} as const

export type SoundName = keyof typeof SPRITES

const pool: Partial<Record<SoundName, Howl>> = {}

function getSound(name: SoundName): Howl {
  if (!pool[name]) {
    pool[name] = new Howl({ src: [SPRITES[name]], volume: 0.35 * boardGain, preload: true })
  }
  return pool[name]!
}

export function setBoardMuted(value: boolean) {
  muted = value
}

export function setBoardGain(gain: number) {
  boardGain = Math.max(0, Math.min(1, gain))
  Object.values(pool).forEach((h) => h?.volume(0.35 * boardGain))
}

export function duckBoardSounds(duck: boolean) {
  const factor = duck ? 0.5 : 1
  Object.values(pool).forEach((h) => h?.volume(0.35 * boardGain * factor))
}

export function playSound(name: SoundName) {
  if (muted) return
  try {
    primed = true
    getSound(name).play()
  } catch {
    /* autoplay / private mode */
  }
}

export function isSoundPrimed() {
  return primed
}
