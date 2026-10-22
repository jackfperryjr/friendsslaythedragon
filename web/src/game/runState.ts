import Phaser from 'phaser'

export const STARTING_LIVES = 3

/**
 * Registry keys that outlive a single run. Everything else in the registry is
 * run progress (bosses beaten, words, keys, score, stats...) and is wiped by
 * resetRunState().
 */
const PERSISTENT_KEYS = new Set<string>([
  'selectedChars',  // last character picked, preselected on the character screen
])

/**
 * Wipes all progress from the current run so the next one starts fresh.
 * Call this whenever a run ends or a new one begins, instead of clearing
 * individual registry keys (it's easy to miss one).
 */
export function resetRunState(registry: Phaser.Data.DataManager) {
  for (const key of Object.keys(registry.getAll())) {
    if (!PERSISTENT_KEYS.has(key)) registry.remove(key)
  }
  registry.set('lives', STARTING_LIVES)
  registry.set('score', 0)
}
