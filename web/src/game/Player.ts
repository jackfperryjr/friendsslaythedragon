import Phaser from 'phaser'
import { DamageType } from '../types'
import { BootScene } from '../scenes/BootScene'
import { SoundManager } from '../audio/SoundManager'

const MOVE_SPEED        = 350
const JUMP_VELOCITY     = -520
const FLOAT_GRAVITY     = -700

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly playerId: number
  readonly charKey:  string

  hearts        = 5
  isAlive       = true
  speedMultiplier  = 1.0
  controlsReversed = false
  speedBoostActive       = false
  strengthBoostActive    = false
  invulnerabilityActive  = false

  isTruck          = false
  isTrex           = false
  isDinoForm       = false   // Carter in dinosaur form
  carterAbility: 'duplicate' | 'dino' = 'duplicate'
  isTransforming   = false   // true during transform/untransform animation
  isShadowForm     = false   // Coco wearing the Shadow costume
  isSpindashing    = false   // Coco executing a spindash

  private hitCount        = 0
  private isFloating      = false
  private isShielding     = false
  private invincible      = false
  private isMeleeing      = false
  private animPrefix: string | null = null
  private rainbowTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, id: number) {
    const selectedChars: string[] | undefined = scene.registry.get('selectedChars')
    const charKey = selectedChars?.[id]
    let resolvedSheet: string | null = null
    let resolvedPrefix: string | null = null
    if (charKey && scene.textures.exists(`sheet-${charKey}`)) {
      resolvedSheet = `sheet-${charKey}`
      resolvedPrefix = `char-${charKey}`
    } else {
      const defaultSheet = BootScene.getSheetKey(id)
      if (defaultSheet && scene.textures.exists(defaultSheet)) {
        resolvedSheet  = defaultSheet
        resolvedPrefix = BootScene.getAnimPrefix(id)
      }
    }
    const textureKey = resolvedSheet ?? BootScene.getFallbackTexture(id)
    super(scene, x, y, textureKey)
    this.playerId = id
    this.charKey  = charKey ?? ''
    this.animPrefix = resolvedPrefix

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setScale(1.3)

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(false)
    body.setSize(42, 60, false)
    body.setOffset(18, 0)
  }

  // ── movement ────────────────────────────────────────────────────────────────

  moveLeft() {
    const dir = this.controlsReversed ? 1 : -1
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * MOVE_SPEED * this.speedMultiplier)
    this.setFlipX(this.controlsReversed ? false : true)
  }
  moveRight() {
    const dir = this.controlsReversed ? -1 : 1
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * MOVE_SPEED * this.speedMultiplier)
    this.setFlipX(this.controlsReversed ? true : false)
  }
  stopHorizontal() { ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(0) }

  jump() {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.down) {
      const vel = this.isSpindashing ? JUMP_VELOCITY * 1.5 : JUMP_VELOCITY
      body.setVelocityY(vel * this.speedMultiplier)
      this.isFloating = false
    } else if (!this.isFloating) {
      this.isFloating = true
    }
  }

  jumpReleased() { this.isFloating = false }

  applySpeedBoost(permanent: boolean) {
    this.speedMultiplier = 3.0
    this.speedBoostActive = true
    if (!permanent) {
      this.scene.time.delayedCall(30000, () => {
        if (this.active) { this.speedMultiplier = 1.0; this.speedBoostActive = false }
      })
    }
  }

  applyStrengthBoost(permanent: boolean) {
    this.strengthBoostActive = true
    if (!permanent) {
      this.scene.time.delayedCall(30000, () => {
        if (this.active) this.strengthBoostActive = false
      })
    }
  }

  applyInvulnerability(permanent: boolean) {
    this.invulnerabilityActive = true
    this.rainbowTimer?.remove()
    let hueIdx = 0
    const rainbow = [0xff6666, 0xff9955, 0xffff55, 0x55ff88, 0x55aaff, 0xcc55ff]
    this.rainbowTimer = this.scene.time.addEvent({
      delay: 80, loop: true,
      callback: () => {
        if (!this.active) { this.rainbowTimer?.remove(); this.rainbowTimer = null; return }
        this.setTint(rainbow[hueIdx % rainbow.length])
        hueIdx++
      },
    })
    if (!permanent) {
      this.scene.time.delayedCall(30000, () => {
        if (this.active) {
          this.invulnerabilityActive = false
          this.rainbowTimer?.remove()
          this.rainbowTimer = null
          this.clearTint()
          this.setAlpha(1)
        }
      })
    }
  }

  applyTempEffect(type: 'fast' | 'reverse', ms: number) {
    if (type === 'fast') {
      this.speedMultiplier = 1.7
      this.scene.time.delayedCall(ms, () => { if (this.active) this.speedMultiplier = 1.0 })
    } else {
      this.controlsReversed = true
      this.setTint(0xcc00ff)
      this.scene.time.delayedCall(ms, () => {
        if (this.active) { this.controlsReversed = false; this.clearTint() }
      })
    }
  }

  update() {
    if (!this.isAlive) return
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setGravityY(this.isFloating ? FLOAT_GRAVITY * this.speedMultiplier : 0)
    if (body.blocked.down) this.isFloating = false
    this.updateAnimation()
  }

  private updateAnimation() {
    if (!this.animPrefix) return
    if (this.isTruck || this.isTrex || this.isDinoForm || this.isTransforming || this.isShadowForm || this.isSpindashing) return  // managed externally
    const body = this.body as Phaser.Physics.Arcade.Body
    const vx = Math.abs(body.velocity.x)

    let anim: string
    if (this.isMeleeing)       anim = 'melee'
    else if (this.isShielding) anim = 'shield'
    else if (this.isFloating)  anim = 'float'
    else if (!body.blocked.down && body.velocity.y > 80) anim = 'fall'
    else if (!body.blocked.down) anim = 'jump'
    else if (vx > 10)          anim = 'walk'
    else                       anim = 'idle'

    const key = `${this.animPrefix}-${anim}`
    if (this.anims.currentAnim?.key !== key) this.play(key, true)
  }

  // ── shield ─────────────────────────────────────────────────────────────────

  get shielding() { return this.isShielding }

  setShielding(active: boolean) { this.isShielding = active }

  // ── actions ─────────────────────────────────────────────────────────────────

  swingMelee() {
    if (this.isMeleeing || !this.isAlive) return
    this.isMeleeing = true
    this.emit('useMelee', this)
    this.scene.time.delayedCall(350, () => { if (this.active) this.isMeleeing = false })
  }

  useCharacterAbility() {
    if (!this.isAlive) return
    this.emit('useCharacterAbility', this)
  }

  // ── damage ──────────────────────────────────────────────────────────────────

  hitByEnemy() {
    if (this.invincible || this.invulnerabilityActive || this.isShielding || this.isTruck || this.isSpindashing || !this.isAlive) return
    SoundManager.playerHit()

    this.hitCount++
    if (this.hitCount >= 5) {
      this.hitCount = 0
      this.hearts--
      this.emit('heartLost', this.hearts)
    }

    this.invincible = true
    this.scene.tweens.add({
      targets: this, alpha: 0.2,
      duration: 120, yoyo: true, repeat: 5,
      onComplete: () => { this.setAlpha(1); this.invincible = false },
    })

    const dx = (this.body as Phaser.Physics.Arcade.Body).velocity.x > 0 ? -1 : 1
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocityX(dx * 250)

    if (this.hearts <= 0) this.die()
  }

  takeDamage(_amount: number, _type: DamageType) { this.hitByEnemy() }

  destroy(fromScene?: boolean) {
    super.destroy(fromScene)
  }

  stun(ms: number) {
    ;(this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    this.setTint(0xffff00)
    this.scene.time.delayedCall(ms, () => this.clearTint())
  }

  die() {
    this.rainbowTimer?.remove()
    this.rainbowTimer = null
    SoundManager.playerDeath()
    this.isAlive = false
    this.setAlpha(0.3)
    this.setTint(0x888888)
    ;(this.body as Phaser.Physics.Arcade.Body).setEnable(false)
    this.emit('died', this)
  }
}
