import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { InputReader } from './InputReader'
import type { TouchControls, TouchFrame } from '../ui/TouchControls'

type FakeKey = { isDown: boolean; timeDown: number }

/** A scene with fake keys and gamepads, so InputReader can be driven directly. */
function setup(touch: Partial<TouchFrame> | null = null) {
  const keys: Record<string, FakeKey> = {}
  const pads: unknown[] = []
  const scene = {
    input: {
      keyboard: { addKey: (name: string) => (keys[name] ??= { isDown: false, timeDown: 0 }) },
      gamepad: { gamepads: pads },
    },
  } as unknown as Phaser.Scene
  const touchControls = touch ? ({ read: () => ({ left: false, right: false, jump: false, down: false, shield: false, ability: false,
    shieldPressed: false, abilityPressed: false, meleePressed: false, interactPressed: false, ...touch }) } as unknown as TouchControls) : null
  const reader = new InputReader(scene, touchControls)
  // Like a real keydown: timestamped now, i.e. after the previous read
  const press = (name: string) => { keys[name].isDown = true; keys[name].timeDown = performance.now() }
  const release = (name: string) => { keys[name].isDown = false }
  return { reader, keys, pads, press, release }
}

describe('InputReader', () => {
  it('ignores keys already held when the room starts', () => {
    const { reader, press } = setup()
    press('X')
    expect(reader.read().abilityPressed).toBe(false)
    expect(reader.read().abilityPressed).toBe(false)
  })

  it('reports a press once, then just "held"', () => {
    const { reader, press } = setup()
    reader.read()
    press('X')
    const first = reader.read()
    expect(first.abilityPressed).toBe(true)
    expect(first.ability).toBe(true)
    const second = reader.read()
    expect(second.abilityPressed).toBe(false)
    expect(second.ability).toBe(true)
  })

  it('catches a tap that starts and ends between two frames', () => {
    const { reader, press, release } = setup()
    reader.read()
    press('Z'); release('Z')
    expect(reader.read().meleePressed).toBe(true)
    expect(reader.read().meleePressed).toBe(false)
  })

  it('accepts WASD, arrow keys and Space', () => {
    const { reader, press } = setup()
    reader.read()
    press('LEFT')
    press('SPACE')
    const f = reader.read()
    expect(f.left).toBe(true)
    expect(f.jump).toBe(true)
    expect(f.jumpPressed).toBe(true)
    expect(f.interactPressed).toBe(true)  // jump also enters doors
  })

  it('reads any connected controller, not just the first slot', () => {
    const { reader, pads } = setup()
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }))
    pads.push(undefined, { connected: true, buttons, leftStick: { x: 0.9, y: 0 } })
    reader.read()
    buttons[0].pressed = true  // A = jump
    const f = reader.read()
    expect(f.right).toBe(true)
    expect(f.jumpPressed).toBe(true)
  })

  it('merges touch controls in', () => {
    const { reader } = setup({ down: true, ability: true, abilityPressed: true })
    const f = reader.read()
    expect(f.down).toBe(true)
    expect(f.ability).toBe(true)
    expect(f.abilityPressed).toBe(true)  // touch presses count even on the first frame
  })
})
