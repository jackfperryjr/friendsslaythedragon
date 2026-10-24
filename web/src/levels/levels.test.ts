import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { generateRun, RoomConfig } from './index'

// Sanity checks on the level data: mistakes here only show up deep into a playthrough.
const rooms = generateRun()
const mapsDir = fileURLToPath(new URL('../../public/maps/', import.meta.url))

describe('the run', () => {
  it('has 21 rooms with unique names', () => {
    expect(rooms).toHaveLength(21)
    expect(new Set(rooms.map(r => r.name)).size).toBe(rooms.length)
  })

  it.each(rooms.map((r, i) => [i, r.name, r] as [number, string, RoomConfig]))(
    'room %i (%s) has its map files on disk', (_i, _name, room) => {
      expect(room.worldMap).toBeDefined()
      const folder = mapsDir + room.worldMap!.folder
      expect(existsSync(`${folder}/map.json`)).toBe(true)
      expect(existsSync(`${folder}/spritesheet.png`)).toBe(true)
    })

  it('uses one cache key per map folder (keys are how loaded maps are reused)', () => {
    const folderForKey = new Map<string, string>()
    const keyForFolder = new Map<string, string>()
    for (const r of rooms) {
      const { key, folder } = r.worldMap!
      expect(folderForKey.get(key) ?? folder).toBe(folder)
      expect(keyForFolder.get(folder) ?? key).toBe(key)
      folderForKey.set(key, folder); keyForFolder.set(folder, key)
    }
  })

  it('hosts each word puzzle and each set of math ducks in only one room', () => {
    const words = rooms.flatMap(r => r.wordLevel ?? [])
    expect(new Set(words).size).toBe(words.length)
    const math = rooms.flatMap(r => r.mathDucks?.prefix ?? [])
    expect(new Set(math).size).toBe(math.length)
  })

  it('gives every boss room a boss and a unique "defeated" flag', () => {
    const keys = rooms.filter(r => r.isBossRoom).map(r => {
      expect(r.bossHp).toBeGreaterThan(0)
      expect(r.bossDefeatedKey).toBeTruthy()
      return r.bossDefeatedKey
    })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('puts NPCs only in non-boss rooms', () => {
    for (const r of rooms) if (r.npcs) expect(r.isBossRoom ?? false).toBe(false)
  })

  it('only locks doors behind puzzles that can be solved before reaching them', () => {
    rooms.forEach((room, i) => {
      for (const req of [room.portalRequires, room.rightExitRequires]) {
        if (!req) continue
        expect(req.hint).not.toBe('')
        const earlier = rooms.slice(0, i + 1)
        const word = /^level(\d+)WordSolved$/.exec(req.flag)
        const key = /^hasLevel(\d+)Key$/.exec(req.flag)
        if (word) {
          // Solved by talking to that level's word duck
          expect(earlier.some(r => r.wordLevel === Number(word[1]))).toBe(true)
        } else if (key) {
          // Solved by opening that level's magic jar
          expect(earlier.some(r => r.items.some(it => it.type === 'key-jar' && it.keyLevel === Number(key[1])))).toBe(true)
        } else {
          throw new Error(`room ${i} (${room.name}) needs unknown flag ${req.flag}`)
        }
      }
    })
  })
})
