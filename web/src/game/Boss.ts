import Phaser from 'phaser'
import { AbilityType } from '../types'
import { Enemy } from './Enemy'

type BossState = 'patrol' | 'stagger'

const PATROL_SPEED = 80

export class Boss extends Enemy {
  readonly maxHp: number
  private bossState: BossState = 'patrol'
  private staggerTimer = 0
  private bossWalkDir = 1
  private invincible = false
  private defeated = false
  private bossAttackTimer: number
  private bossFlying = false
  private bossStationary = false
  private attackRate: number
  private spawnY = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    _attackInterval = 3000,
    textureKey = 'sheet-king-skeleton',
    flying = true,
    stationary = false,
    attackRate = 3000,
    scale = 3.45,
  ) {
    super(scene, x, y, AbilityType.None)
    this.hp = hp
    this.maxHp = hp
    this.bossStationary = stationary
    this.attackRate = attackRate
    this.bossAttackTimer = attackRate * (0.6 + Math.random() * 0.4)
    this.spawnY = y

    const body = this.body as Phaser.Physics.Arcade.Body

    if (scene.textures.exists(textureKey)) {
      this.setTexture(textureKey, 0)
      this.setScale(scale)
      if (flying) {
        body.setAllowGravity(false)
        this.bossFlying = true
      }
      if (stationary) {
        // Anchor stationary bosses — no gravity, stays exactly at spawn position
        body.setAllowGravity(false)
      }
      // Scale hitbox proportionally to frame size.
      // Base calibration is for 64×64 frames: setSize(32,23), setOffset(16, flying?20:41)
      const frame = scene.textures.getFrame(textureKey, 0)
      const fw = frame?.realWidth ?? 64
      const fs = fw / 64
      body.setSize(32 * fs, 23 * fs)
      body.setOffset(16 * fs, flying ? 20 * fs : 41 * fs)
      const walkAnim = `${textureKey}-walk`
      if (scene.anims.exists(walkAnim)) this.play(walkAnim)
    } else {
      this.setScale(1.3)
      body.setSize(46, 50)
    }
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body
    const dt = this.scene.game.loop.delta

    if (this.bossState === 'stagger') {
      this.staggerTimer -= dt
      if (this.staggerTimer <= 0) {
        this.bossState = 'patrol'
        this.clearTint()
      }
      body.setVelocity(0, 0)
      return
    }

    // Patrol (stationary bosses stay put)
    if (!this.bossStationary) {
      if (body.blocked.left)  this.bossWalkDir = 1
      if (body.blocked.right) this.bossWalkDir = -1
      body.setVelocityX(PATROL_SPEED * this.bossWalkDir)
    } else {
      body.setVelocityX(0)
    }
    if (this.bossFlying) {
      // Spring keeps boss near spawnY so it can't drift to the floor
      body.setVelocityY(Math.sin(this.scene.time.now / 800) * 55 - (this.y - this.spawnY) * 2)
    }
    this.setFlipX(this.bossWalkDir > 0)

    // Attack timer
    this.bossAttackTimer -= dt
    if (this.bossAttackTimer <= 0) {
      this.bossAttackTimer = this.attackRate * (0.8 + Math.random() * 0.4)
      const abilities = [AbilityType.Fire, AbilityType.Lightning, AbilityType.Ice]
      this.emit('bossAttack', abilities[Math.floor(Math.random() * abilities.length)])
    }
  }

  hit() {
    if (this.invincible || !this.active || this.defeated) return
    this.hp = Math.max(0, this.hp - 1)
    this.emit('hpChanged', this.hp, this.maxHp)
    if (this.hp <= 0) {
      this.bossDie()
      return
    }
    this.invincible = true
    this.enterStagger(600)
    this.scene.cameras.main.shake(160, 0.007)
    this.scene.time.delayedCall(600, () => { if (this.active) this.invincible = false })
  }

  die() { this.hit() }

  /** Kills the boss. Safe to call more than once; emits 'bossDead' only the first time. */
  bossDie() {
    if (this.defeated) return
    this.defeated = true
    this.emit('hpChanged', 0, this.maxHp)
    ;(this.body as Phaser.Physics.Arcade.Body).setEnable(false)
    this.emit('bossDead')
    this.scene.tweens.add({
      targets: this,
      alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 700,
      onComplete: () => { if (this.active) this.destroy() },
    })
  }

  pullToward(_tx: number, _ty: number, _speed: number) {}
  stopPull() {}

  private enterStagger(ms: number) {
    this.bossState = 'stagger'
    this.staggerTimer = ms
    this.setTint(0xffffff)
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
  }
}
