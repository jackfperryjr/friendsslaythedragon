import Phaser from 'phaser'
import { Player } from '../game/Player'

export class TouchControls {
  private dpadLeft  = false
  private dpadRight = false
  private jumpHeld    = false
  private inhaleHeld  = false
  private abilityJust = false
  private meleeJust   = false
  private _interactJust = false

  private _enabled = true
  private _allObjects: (Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[] = []

  private joystickBase!: Phaser.GameObjects.Arc
  private joystickKnob!: Phaser.GameObjects.Arc
  private joystickActive = false
  private joystickPointer: Phaser.Input.Pointer | null = null
  private joystickBaseX = 0
  private joystickBaseY = 0

  private readonly JOYSTICK_RADIUS = 70
  private readonly KNOB_RADIUS = 26
  private readonly DEAD_ZONE = 15
  private readonly H_DEAD_ZONE = 24

  constructor(private scene: Phaser.Scene) {
    this.buildButtons()
  }

  get interactJust(): boolean {
    const v = this._interactJust
    this._interactJust = false
    return v
  }

  setEnabled(v: boolean) {
    this._enabled = v
    for (const o of this._allObjects) o.setVisible(v)
    if (!v) {
      this.dpadLeft = false
      this.dpadRight = false
      this.jumpHeld = false
      this.inhaleHeld = false
      this.abilityJust = false
      this.meleeJust = false
      this._interactJust = false
      this.joystickActive = false
      this.joystickPointer = null
      this.joystickKnob?.setPosition(this.joystickBaseX, this.joystickBaseY)
    }
  }

  private buildButtons() {
    const { width, height } = this.scene.scale

    this.buildJoystick(height)

    // Action buttons (right side)
    const bx = width - 65
    const by = height - 80
    this.btn(bx,      by,      '▲', 0x4fc3f7, () => { this._interactJust = true })
    this.btn(bx,      by - 84, 'X',  0xa5d6a7, () => { this.abilityJust = true })
    this.btn(bx - 84, by - 84, 'Z',  0xce93d8, () => { this.inhaleHeld = true }, () => { this.inhaleHeld = false })
    this.btn(bx - 84, by,      '⚔', 0xef9a9a, () => { this.meleeJust = true })
  }

  private buildJoystick(height: number) {
    this.joystickBaseX = 110
    this.joystickBaseY = height - 110

    this.joystickBase = this.scene.add.circle(
      this.joystickBaseX, this.joystickBaseY,
      this.JOYSTICK_RADIUS, 0x90caf9, 0.25
    ).setScrollFactor(0).setDepth(50).setInteractive()

    this.joystickKnob = this.scene.add.circle(
      this.joystickBaseX, this.joystickBaseY,
      this.KNOB_RADIUS, 0x90caf9, 0.7
    ).setScrollFactor(0).setDepth(51)

    this._allObjects.push(this.joystickBase, this.joystickKnob)

    this.joystickBase.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.joystickActive = true
      this.joystickPointer = ptr
      this.updateJoystick(ptr.x, ptr.y)
    })

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.joystickActive && ptr === this.joystickPointer) {
        this.updateJoystick(ptr.x, ptr.y)
      }
    })

    this.scene.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (this.joystickActive && ptr === this.joystickPointer) {
        this.resetJoystick()
      }
    })
  }

  private updateJoystick(px: number, py: number) {
    const dx = px - this.joystickBaseX
    const dy = py - this.joystickBaseY
    const mag = Math.sqrt(dx * dx + dy * dy)

    if (mag > 0) {
      const clamp = Math.min(mag, this.JOYSTICK_RADIUS)
      const angle = Math.atan2(dy, dx)
      this.joystickKnob.setPosition(
        this.joystickBaseX + Math.cos(angle) * clamp,
        this.joystickBaseY + Math.sin(angle) * clamp
      )
    }

    // Per-axis dead zones: larger horizontal dead zone reduces left/right drift during jumps
    this.dpadLeft  = dx < -this.H_DEAD_ZONE
    this.dpadRight = dx > this.H_DEAD_ZONE
    this.jumpHeld  = dy < -this.DEAD_ZONE
  }

  private resetJoystick() {
    this.joystickActive = false
    this.joystickPointer = null
    this.dpadLeft = false
    this.dpadRight = false
    this.jumpHeld = false
    this.joystickKnob.setPosition(this.joystickBaseX, this.joystickBaseY)
  }

  private btn(x: number, y: number, label: string, color: number, onDown: () => void, onUp?: () => void) {
    const circle = this.scene.add.circle(x, y, 36, color, 0.7)
      .setScrollFactor(0).setDepth(50).setInteractive()
    const lbl = this.scene.add.text(x, y, label, { fontSize: '20px', color: '#000', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(51)
    this._allObjects.push(circle, lbl)
    circle.on('pointerdown', onDown)
    if (onUp) { circle.on('pointerup', onUp); circle.on('pointerout', onUp) }
  }

  apply(player: Player) {
    if (!this._enabled || !player.isAlive || player.isInhaled) return

    if (this.dpadLeft) player.moveLeft()
    else if (this.dpadRight) player.moveRight()
    else player.stopHorizontal()

    if (this.jumpHeld) player.jump()
    else player.jumpReleased()

    player.setShielding(this.inhaleHeld)
    if (this.abilityJust) { player.useCharacterAbility(); this.abilityJust = false }
    if (this.meleeJust)   { player.swingMelee(); this.meleeJust = false }
  }

  destroy() {
    // objects are scene-managed; no manual teardown needed
  }
}
