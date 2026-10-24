import type Phaser from 'phaser'
import type { TouchControls } from '../ui/TouchControls'

/**
 * One frame of player input, merged from keyboard, every connected gamepad,
 * and touch controls. Read it once per frame with `InputReader.read()` and
 * pass it around — never poll keys directly, or "just pressed" edges get lost.
 */
export interface InputFrame {
  // Held this frame
  left: boolean
  right: boolean
  down: boolean
  jump: boolean
  shield: boolean
  ability: boolean
  // Went down this frame
  jumpPressed: boolean
  shieldPressed: boolean
  abilityPressed: boolean
  meleePressed: boolean
  /** Enter doors and portals */
  interactPressed: boolean
  /** Talk to NPCs (ducks) */
  talkPressed: boolean
}

type Action = 'left' | 'right' | 'down' | 'jump' | 'shield' | 'ability' | 'melee'

export const KEY_BINDINGS: Record<Action, string[]> = {
  left:    ['A', 'LEFT'],
  right:   ['D', 'RIGHT'],
  down:    ['S', 'DOWN'],
  jump:    ['W', 'UP', 'SPACE'],
  shield:  ['C'],
  ability: ['X'],
  melee:   ['Z'],
}

// Standard gamepad mapping (Xbox / PlayStation layout)
const PAD = { A: 0, B: 1, X: 2, Y: 3, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const
const STICK_DEAD_ZONE = 0.25

type Held = Record<'left' | 'right' | 'down' | 'jump' | 'shield' | 'ability' | 'melee' | 'interact' | 'talk', boolean>

export class InputReader {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>
  private prev: Held | null = null
  private lastReadAt = performance.now()

  constructor(private scene: Phaser.Scene, private touch: TouchControls | null) {
    const kb = scene.input.keyboard
    const make = (names: string[]) => kb ? names.map(n => kb.addKey(n)) : []
    this.keys = {
      left: make(KEY_BINDINGS.left), right: make(KEY_BINDINGS.right), down: make(KEY_BINDINGS.down),
      jump: make(KEY_BINDINGS.jump), shield: make(KEY_BINDINGS.shield),
      ability: make(KEY_BINDINGS.ability), melee: make(KEY_BINDINGS.melee),
    }
  }

  read(): InputFrame {
    const kb = (a: Action) => this.keys[a].some(k => k.isDown)
    // A tap shorter than one frame is down and up again before we look, so also
    // count any key that went down since the last read (Key.timeDown is the event time).
    const since = this.lastReadAt
    this.lastReadAt = performance.now()
    const firstRead = this.prev === null
    const tapped = (a: Action) => !firstRead && this.keys[a].some(k => k.timeDown > since)
    const pads = (this.scene.input.gamepad?.gamepads ?? []).filter(p => p?.connected)
    const btn = (i: number) => pads.some(p => !!p.buttons[i]?.pressed)
    const t = this.touch?.read()

    const held: Held = {
      left:     kb('left')  || btn(PAD.LEFT)  || pads.some(p => p.leftStick.x < -STICK_DEAD_ZONE) || !!t?.left,
      right:    kb('right') || btn(PAD.RIGHT) || pads.some(p => p.leftStick.x >  STICK_DEAD_ZONE) || !!t?.right,
      down:     kb('down')  || btn(PAD.DOWN)  || pads.some(p => p.leftStick.y >  STICK_DEAD_ZONE) || !!t?.down,
      jump:     kb('jump')  || btn(PAD.A)     || !!t?.jump,
      shield:   kb('shield') || btn(PAD.Y)    || !!t?.shield,
      ability:  kb('ability') || btn(PAD.B) || !!t?.ability,
      melee:    kb('melee') || btn(PAD.X),
      interact: kb('jump')  || btn(PAD.UP),
      talk:     kb('ability') || btn(PAD.X),
    }

    // The first frame only records state, so a key still held from the
    // previous room doesn't count as a fresh press.
    const prev = this.prev ?? held
    this.prev = held
    const edge = (k: keyof Held) => held[k] && !prev[k]

    return {
      left: held.left, right: held.right, down: held.down,
      jump: held.jump, shield: held.shield, ability: held.ability,
      jumpPressed:     edge('jump')     || tapped('jump'),
      shieldPressed:   edge('shield')   || tapped('shield')  || !!t?.shieldPressed,
      abilityPressed:  edge('ability')  || tapped('ability') || !!t?.abilityPressed,
      meleePressed:    edge('melee')    || tapped('melee')   || !!t?.meleePressed,
      interactPressed: edge('interact') || tapped('jump')    || !!t?.interactPressed,
      talkPressed:     edge('talk')     || tapped('ability') || !!t?.interactPressed,
    }
  }
}
