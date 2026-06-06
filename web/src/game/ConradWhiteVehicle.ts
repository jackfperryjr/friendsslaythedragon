import Phaser from 'phaser'

export type WhiteVehicleType = 'truck' | 'tank' | 'helicopter'

const FIRE_RATE    = 1600
const ATTACK_RANGE = 240
const MOVE_SPEED   = 700
const LIFETIME_MS  = 10000

const RAINBOW_TINTS = [0xFF2222, 0xFF8800, 0xFFFF00, 0x44FF44, 0x00FFEE, 0x4488FF, 0xAA44FF]

const SHEET: Record<WhiteVehicleType, string> = {
  truck:      'sheet-white-truck',
  tank:       'sheet-white-tank',
  helicopter: 'sheet-white-heli',
}

export class ConradWhiteVehicle extends Phaser.Physics.Arcade.Sprite {
  readonly vehicleType: WhiteVehicleType
  isShooting = false

  private fireTimer: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number, vehicleType: WhiteVehicleType) {
    super(scene, x, y, SHEET[vehicleType], 0)
    this.vehicleType = vehicleType
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setScale(1.3).setDepth(3)
    this.setTint(Phaser.Math.RND.pick(RAINBOW_TINTS))

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(54, 40, false)
    body.setOffset(5, 5)
    body.setAllowGravity(vehicleType !== 'helicopter')

    scene.time.delayedCall(LIFETIME_MS, () => { if (this.active) this.die() })

    this.fireTimer = scene.time.addEvent({
      delay: FIRE_RATE,
      loop: true,
      callback: () => {
        if (!this.active || !this.isShooting) return
        this.emit('fireShot', this)
        scene.time.delayedCall(150, () => { if (this.active && this.isShooting) this.emit('fireShot', this) })
        scene.time.delayedCall(300, () => { if (this.active && this.isShooting) this.emit('fireShot', this) })
      },
    })
  }

  static get attackRange() { return ATTACK_RANGE }
  static get moveSpeed()   { return MOVE_SPEED   }

  die() {
    this.fireTimer.remove()
    this.emit('vehicleExpired', this)
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 400,
      onComplete: () => { if (this.active) this.destroy() },
    })
  }
}
