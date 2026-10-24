import type Phaser from 'phaser'

/** Just enough of Phaser's DataManager (scene.registry) for unit tests. */
export function fakeRegistry(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get: (k: string) => data.get(k),
    set: (k: string, v: unknown) => { data.set(k, v) },
    remove: (k: string) => { data.delete(k) },
    getAll: () => Object.fromEntries(data),
  } as unknown as Phaser.Data.DataManager
}
