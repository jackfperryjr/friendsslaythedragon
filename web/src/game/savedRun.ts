import type Phaser from 'phaser'
import { generateRun } from '../levels'
import { resetRunState } from './runState'

/**
 * The run in progress, saved in the browser each time the player enters a room,
 * so closing the tab or quitting to the menu doesn't lose progress. The main
 * menu offers CONTINUE while a save exists; a game over or reaching the end clears it.
 *
 * What's saved is the run's registry data (bosses beaten, words, keys, hearts,
 * boosts, coins, stats...). The room list isn't saved: generateRun() rebuilds it.
 */

const STORAGE_KEY = 'friendsslay.run.v1'
const VERSION = 1

/** Registry keys that are rebuilt on load instead of saved. */
const NOT_SAVED = new Set(['runRooms', 'runStartTime'])

interface SavedRun {
  version: number
  savedAt: number
  /** Play time so far, so the best-time clock doesn't count time spent away. */
  elapsedMs: number
  /** Name of the room the player will continue from (shown on the menu). */
  roomName: string
  data: Record<string, unknown>
}

function read(): SavedRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const save = JSON.parse(raw) as SavedRun
    if (save?.version !== VERSION || typeof save.data?.runIndex !== 'number') return null
    if (save.data.runIndex < 0 || save.data.runIndex >= generateRun().length) return null
    return save
  } catch {
    return null
  }
}

/** Saves the current run. Call when the player has just entered a room. */
export function saveRun(registry: Phaser.Data.DataManager, roomName: string) {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(registry.getAll())) {
    if (!NOT_SAVED.has(key) && value !== undefined) data[key] = value
  }
  const started: number = registry.get('runStartTime') ?? Date.now()
  const save: SavedRun = { version: VERSION, savedAt: Date.now(), elapsedMs: Date.now() - started, roomName, data }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch { /* storage full or blocked — the run just won't be resumable */ }
}

/** Room name of the saved run, or null if there's nothing to continue. */
export function savedRunRoomName(): string | null {
  return read()?.roomName ?? null
}

/**
 * Loads the saved run into the registry. Returns false if there was nothing
 * valid to load. Start GameScene afterwards.
 */
export function loadSavedRun(registry: Phaser.Data.DataManager): boolean {
  const save = read()
  if (!save) return false
  resetRunState(registry)
  for (const [key, value] of Object.entries(save.data)) registry.set(key, value)
  registry.set('runRooms', generateRun())
  registry.set('runStartTime', Date.now() - save.elapsedMs)
  return true
}

export function clearSavedRun() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* nothing to do */ }
}
