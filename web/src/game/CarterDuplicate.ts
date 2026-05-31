import Phaser from 'phaser'

const FIRE_INTERVAL = 900

export class CarterDuplicate extends Phaser.Physics.Arcade.Sprite {
  private hp = 2
  private fireTimer: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, x: number, y: number, sheetKey: string) {
    super(scene, x, y, sheetKey, 9)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setScale(1.3).setDepth(3)

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(42, 60, false)
    body.setOffset(18, 0)
    body.setImmovable(true)
    body.setAllowGravity(true)

    scene.time.delayedCall(10000, () => { if (this.active) this.die() })

    // Stagger the first shot so multiple duplicates don't all fire together
    const delay = 500 + Math.random() * FIRE_INTERVAL
    this.fireTimer = scene.time.addEvent({
      delay,
      callback: () => {
        if (!this.active) return
        this.emit('fireLaser', this)
        this.fireTimer.reset({ delay: FIRE_INTERVAL, loop: true, callback: () => {
          if (this.active) this.emit('fireLaser', this)
        }})
      },
    })
  }

  hit() {
    this.hp--
    if (!this.active) return
    this.scene.tweens.add({
      targets: this, alpha: 0.2, duration: 80, yoyo: true, repeat: 2,
      onComplete: () => { if (this.active) this.setAlpha(1) },
    })
    if (this.hp <= 0) this.die()
  }

  private die() {
    this.fireTimer.remove()
    this.emit('duplicateDied', this)
    this.scene.tweens.add({
      targets: this, alpha: 0, scaleY: 0, duration: 300,
      onComplete: () => { if (this.active) this.destroy() },
    })
  }
}
