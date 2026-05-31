import Phaser from 'phaser'

const FIRE_RATE    = 1600   // ms between bursts while stopped
const ATTACK_RANGE = 180    // px — stop and shoot within this distance
const MOVE_SPEED   = 700    // 2× player speed
const LIFETIME_MS  = 10000

export class ConradArmyTruck extends Phaser.Physics.Arcade.Sprite {
  isShooting = false

  private fireTimer: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'sheet-army-truck', 0)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setScale(1.3).setDepth(3)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(54, 40, false)
    body.setOffset(5, 5)
    body.setAllowGravity(true)

    scene.time.delayedCall(LIFETIME_MS, () => { if (this.active) this.die() })

    this.fireTimer = scene.time.addEvent({
      delay: FIRE_RATE,
      loop: true,
      callback: () => {
        if (!this.active || !this.isShooting) return
        // 3-round burst: fire immediately, then +150 ms, then +300 ms
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
    this.emit('truckExpired', this)
    this.scene.tweens.add({
      targets: this, alpha: 0, duration: 400,
      onComplete: () => { if (this.active) this.destroy() },
    })
  }
}
