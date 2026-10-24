// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { saveRun, loadSavedRun, savedRunRoomName, clearSavedRun } from './savedRun'
import { generateRun } from '../levels'
import { fakeRegistry } from '../test/fakeRegistry'

describe('saved run', () => {
  beforeEach(() => localStorage.clear())

  it('is empty until something is saved', () => {
    expect(savedRunRoomName()).toBeNull()
    expect(loadSavedRun(fakeRegistry())).toBe(false)
  })

  it('round-trips run progress and rebuilds the room list', () => {
    const rooms = generateRun()
    const reg = fakeRegistry({
      runRooms: rooms, runIndex: 4, entryDir: 'left', selectedChars: ['eric'], goldCoins: 250,
      skeletonKingDefeated: true, level3Word: 'PIZZA', runStartTime: Date.now() - 60_000,
    })
    saveRun(reg, rooms[4].name)
    expect(savedRunRoomName()).toBe(rooms[4].name)

    const restored = fakeRegistry({ leftover: 'from another run' })
    expect(loadSavedRun(restored)).toBe(true)
    expect(restored.get('runIndex')).toBe(4)
    expect(restored.get('selectedChars')).toEqual(['eric'])
    expect(restored.get('goldCoins')).toBe(250)
    expect(restored.get('skeletonKingDefeated')).toBe(true)
    expect(restored.get('leftover')).toBeUndefined()
    expect((restored.get('runRooms') as unknown[]).length).toBe(rooms.length)
  })

  it('carries over play time, not time spent away', () => {
    const reg = fakeRegistry({ runIndex: 0, runStartTime: Date.now() - 90_000 })
    saveRun(reg, 'The Castle')
    const restored = fakeRegistry()
    loadSavedRun(restored)
    const elapsed = Date.now() - (restored.get('runStartTime') as number)
    expect(elapsed).toBeGreaterThanOrEqual(90_000)
    expect(elapsed).toBeLessThan(95_000)
  })

  it('ignores saves pointing at a room that no longer exists', () => {
    saveRun(fakeRegistry({ runIndex: 999 }), 'Nowhere')
    expect(savedRunRoomName()).toBeNull()
  })

  it('ignores corrupt or old-format data', () => {
    localStorage.setItem('friendsslay.run.v1', '{not json')
    expect(savedRunRoomName()).toBeNull()
    localStorage.setItem('friendsslay.run.v1', JSON.stringify({ version: 0, data: { runIndex: 1 } }))
    expect(savedRunRoomName()).toBeNull()
  })

  it('can be cleared', () => {
    saveRun(fakeRegistry({ runIndex: 0 }), 'The Castle')
    clearSavedRun()
    expect(savedRunRoomName()).toBeNull()
  })
})
