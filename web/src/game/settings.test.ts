// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// settings.ts imports SoundManager (which pulls in Phaser) for setSoundMuted — stub it
vi.mock('../audio/SoundManager', () => ({ SoundManager: { setMuted: vi.fn(), isMuted: () => false } }))

// settings.ts caches what it reads, so load a fresh copy for each test
async function freshSettings() {
  vi.resetModules()
  return import('./settings')
}

describe('settings', () => {
  beforeEach(() => localStorage.clear())

  it('starts from defaults', async () => {
    const { loadSettings } = await freshSettings()
    expect(loadSettings()).toEqual({ muted: false, lastCharacter: null, bestTimeSec: null, bestScore: null })
  })

  it('remembers changes across page loads', async () => {
    ;(await freshSettings()).updateSettings({ muted: true, lastCharacter: 'abby' })
    const { loadSettings } = await freshSettings()
    expect(loadSettings()).toMatchObject({ muted: true, lastCharacter: 'abby' })
  })

  it('survives corrupt storage', async () => {
    localStorage.setItem('friendsslay.settings.v1', 'nope{')
    const { loadSettings } = await freshSettings()
    expect(loadSettings().muted).toBe(false)
  })

  it('only records a run time when it beats the best', async () => {
    const { recordRunTime, loadSettings } = await freshSettings()
    expect(recordRunTime(600)).toBe(true)
    expect(recordRunTime(700)).toBe(false)
    expect(recordRunTime(500)).toBe(true)
    expect(loadSettings().bestTimeSec).toBe(500)
  })

  it('only records a score when it beats the high score', async () => {
    const { recordScore, loadSettings } = await freshSettings()
    expect(recordScore(0)).toBe(false)
    expect(recordScore(1200)).toBe(true)
    expect(recordScore(1200)).toBe(false)
    expect(recordScore(800)).toBe(false)
    expect(loadSettings().bestScore).toBe(1200)
  })

  it('formats times and scores for display', async () => {
    const { formatDuration, formatScore } = await freshSettings()
    expect(formatDuration(65)).toBe('1m 05s')
    expect(formatDuration(3600)).toBe('60m 00s')
    expect(formatScore(1234567)).toBe('1,234,567')
  })
})
