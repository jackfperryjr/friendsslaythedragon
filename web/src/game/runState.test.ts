import { describe, expect, it } from 'vitest'
import { resetRunState, STARTING_LIVES } from './runState'
import { fakeRegistry } from '../test/fakeRegistry'

describe('resetRunState', () => {
  it('clears all run progress and starts a fresh run', () => {
    const reg = fakeRegistry({
      skeletonKingDefeated: true, hasLevel1Key: true, level3Word: 'PIZZA', goldCoins: 420,
      score: 9000, lives: 1, persistedBoosts: { speedMs: 100 }, runIndex: 12,
    })
    resetRunState(reg)
    expect(reg.getAll()).toEqual({ lives: STARTING_LIVES, score: 0 })
  })

  it('keeps the chosen character', () => {
    const reg = fakeRegistry({ selectedChars: ['coco'], dadSaved: true })
    resetRunState(reg)
    expect(reg.get('selectedChars')).toEqual(['coco'])
    expect(reg.get('dadSaved')).toBeUndefined()
  })
})
