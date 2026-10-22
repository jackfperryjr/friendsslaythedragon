import { SoundManager } from '../audio/SoundManager'

/**
 * Player preferences and personal bests, saved in the browser (localStorage)
 * so they survive page reloads. Reads and writes never throw: private browsing
 * or blocked storage just means nothing is remembered.
 */
export interface Settings {
  muted: boolean
  /** Character picked last time, preselected on the character screen. */
  lastCharacter: string | null
  /** Fastest run to the Silly Dragon, in seconds. */
  bestTimeSec: number | null
}

const STORAGE_KEY = 'friendsslay.settings.v1'
const DEFAULTS: Settings = { muted: false, lastCharacter: null, bestTimeSec: null }

let cache: Settings | null = null

export function loadSettings(): Settings {
  if (cache) return cache
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}
  } catch { /* unavailable or corrupt — use defaults */ }
  cache = { ...DEFAULTS, ...stored }
  return cache
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...loadSettings(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch { /* storage full or blocked — keep the in-memory copy */ }
  return cache
}

/** Records a finished run's time. Returns true if it beat the previous best. */
export function recordRunTime(seconds: number): boolean {
  const best = loadSettings().bestTimeSec
  if (best !== null && seconds >= best) return false
  updateSettings({ bestTimeSec: seconds })
  return true
}

export function formatDuration(totalSec: number): string {
  const mins = Math.floor(totalSec / 60)
  const secs = (totalSec % 60).toString().padStart(2, '0')
  return `${mins}m ${secs}s`
}

/** Turns all game audio on or off and remembers the choice. */
export function setSoundMuted(muted: boolean) {
  SoundManager.setMuted(muted)
  updateSettings({ muted })
}
