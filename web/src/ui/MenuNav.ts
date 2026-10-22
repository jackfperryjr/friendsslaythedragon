import Phaser from 'phaser'

const FONT = '"Press Start 2P", monospace'

export interface MenuItem {
  text: Phaser.GameObjects.Text
  action: () => void
}

interface MenuNavOptions {
  /** Text colour of unfocused / focused items. Pass null to leave colours alone. */
  colors?: { normal: string; focus: string } | null
  cursorColor?: string
  cursorSize?: number
  depth?: number
  /** Gamepad buttons that activate the focused item (default: A and Start). */
  activateButtons?: number[]
}

/**
 * Keyboard + gamepad navigation for a vertical (or horizontal) list of text
 * buttons. Arrow keys / WASD or the d-pad / left stick move a ► cursor;
 * Enter / Space or A / Start activates. Works with any connected controller.
 *
 * Mouse/touch handling stays on the buttons themselves.
 */
export class MenuNav {
  private items: MenuItem[] = []
  private idx = 0
  private cursor: Phaser.GameObjects.Text
  private stickHeld = false
  private colors: { normal: string; focus: string } | null
  private activateButtons: number[]
  /** When false, input is ignored (e.g. while a pause menu is hidden). */
  enabled = true

  constructor(private scene: Phaser.Scene, opts: MenuNavOptions = {}) {
    this.colors = opts.colors === undefined ? { normal: '#ffffff', focus: '#ffe066' } : opts.colors
    this.activateButtons = opts.activateButtons ?? [0, 9]
    this.cursor = scene.add.text(0, 0, '►', {
      fontSize: `${opts.cursorSize ?? 14}px`, fontFamily: FONT, color: opts.cursorColor ?? '#ffe066',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(opts.depth ?? 1000).setVisible(false)

    scene.input.keyboard?.on('keydown', this.onKey)
    scene.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, this.onPad)
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.pollStick)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown', this.onKey)
      scene.input.gamepad?.off(Phaser.Input.Gamepad.Events.BUTTON_DOWN, this.onPad)
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.pollStick)
    })
  }

  /** Replaces the list. The cursor stays hidden until the player first navigates. */
  setItems(items: MenuItem[]) {
    if (this.colors) this.items.forEach(it => it.text.active && it.text.setColor(this.colors!.normal))
    this.items = items
    this.idx = 0
    this.cursor.setVisible(false)
  }

  move(dir: number) {
    const len = this.items.length
    if (!len) return
    this.idx = (this.idx + dir + len) % len
    this.show()
  }

  activate() {
    this.items[this.idx]?.action()
  }

  hideCursor() {
    this.cursor.setVisible(false)
  }

  private show() {
    const item = this.items[this.idx]
    if (!item?.text.active) return
    if (this.colors) this.items.forEach((it, i) => it.text.active && it.text.setColor(i === this.idx ? this.colors!.focus : this.colors!.normal))
    const b = item.text.getBounds()
    this.cursor.setPosition(b.left - 10, b.centerY).setVisible(true)
  }

  private canUse() {
    return this.enabled && this.items.length > 0
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.canUse() || e.repeat) return
    switch (e.code) {
      case 'ArrowUp': case 'ArrowLeft': case 'KeyW': case 'KeyA': this.move(-1); break
      case 'ArrowDown': case 'ArrowRight': case 'KeyS': case 'KeyD': this.move(1); break
      case 'Enter': case 'Space': case 'NumpadEnter': this.activate(); break
    }
  }

  private onPad = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (!this.canUse()) return
    if (button.index === 12 || button.index === 14) this.move(-1)
    else if (button.index === 13 || button.index === 15) this.move(1)
    else if (this.activateButtons.includes(button.index)) this.activate()
  }

  // Some controllers report the d-pad as a stick; also lets the left stick navigate
  private pollStick = () => {
    if (!this.canUse()) return
    const pads = (this.scene.input.gamepad?.gamepads ?? []).filter(p => p?.connected)
    const y = pads.reduce((acc, p) => Math.abs(p.leftStick.y) > Math.abs(acc) ? p.leftStick.y : acc, 0)
    if (!this.stickHeld) {
      if (y < -0.5)     { this.stickHeld = true; this.move(-1) }
      else if (y > 0.5) { this.stickHeld = true; this.move(1) }
    } else if (Math.abs(y) < 0.25) {
      this.stickHeld = false
    }
  }
}
