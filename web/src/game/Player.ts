import Phaser from 'phaser'
import { DamageType } from '../types'
import { BootScene } from '../scenes/BootScene'
import { SoundManager } from '../audio/SoundManager'

const MOVE_SPEED        = 350
type Boost = 'speed' | 'strength' | 'invuln'

const JUMP_VELOCITY     = -520
const FLOAT_GRAVITY     = -700

export class Player extends Phaser.Physics.Arcade.Sprite {
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
  carterAbility: 'duplicate' | 'dino' = 'dino'
  isConradTransformed = false
  isFlyingDown        = false
  conradAbility: 'truck' | 'transform' = 'transform'
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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const selectedChars: string[] | undefined = scene.registry.get('selectedChars')
    const charKey = selectedChars?.[0]
    let resolvedSheet: string | null = null
    let resolvedPrefix: string | null = null
    if (charKey && scene.textures.exists(`sheet-${charKey}`)) {
      resolvedSheet = `sheet-${charKey}`
      resolvedPrefix = `char-${charKey}`
    } else {
      const defaultSheet = BootScene.getDefaultSheetKey()
      if (scene.textures.exists(defaultSheet)) {
        resolvedSheet  = defaultSheet
        resolvedPrefix = BootScene.getDefaultAnimPrefix()
      }
    }
    const textureKey = resolvedSheet ?? BootScene.getFallbackTexture()
    super(scene, x, y, textureKey)
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

  /** Default length of a timed boost (mystery boxes, the shop). */
  static readonly BOOST_MS = 30000

  // Play time left on each boost, in ms: 0 = inactive, Infinity = permanent.
  // Counted down in update(), which only runs while the game isn't paused.
  private boostLeft: Record<Boost, number> = { speed: 0, strength: 0, invuln: 0 }

  /**
   * `duration`: true = permanent, false = the default 30 s, or a number of ms.
   * Re-applying a timed boost extends it rather than stacking timers.
   */
  applySpeedBoost(duration: boolean | number) {
    this.speedMultiplier = 3.0
    this.speedBoostActive = true
    this.extendBoost('speed', duration)
  }

  applyStrengthBoost(duration: boolean | number) {
    this.strengthBoostActive = true
    this.extendBoost('strength', duration)
  }

  applyInvulnerability(duration: boolean | number) {
    this.invulnerabilityActive = true
    this.extendBoost('invuln', duration)
    if (this.rainbowTimer) return
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
  }

  /** Ms left on a boost: 0 if inactive, Infinity if permanent. Used to carry boosts between rooms. */
  boostTimeLeft(boost: Boost): number {
    return this.boostLeft[boost]
  }

  private extendBoost(boost: Boost, duration: boolean | number) {
    const ms = duration === true ? Infinity : duration === false ? Player.BOOST_MS : duration
    this.boostLeft[boost] = Math.max(this.boostLeft[boost], ms)
  }

  /** Counts timed boosts down and ends the ones that run out (called every frame from update). */
  private expireBoosts() {
    const dt = this.scene.game.loop.delta
    const done = (b: Boost) => {
      const left = this.boostLeft[b]
      if (left <= 0 || left === Infinity) return false
      this.boostLeft[b] = Math.max(0, left - dt)
      return this.boostLeft[b] === 0
    }
    if (done('speed')) {
      this.speedBoostActive = false
      if (this.speedMultiplier === 3.0) this.speedMultiplier = 1.0  // leave transformation speeds alone
    }
    if (done('strength')) {
      this.strengthBoostActive = false
    }
    if (done('invuln')) {
      this.invulnerabilityActive = false
      this.rainbowTimer?.remove()
      this.rainbowTimer = null
      this.clearTint()
      this.setAlpha(1)
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
    this.expireBoosts()
    if (!this.isAlive) return
    const body = this.body as Phaser.Physics.Arcade.Body
    if (this.isConradTransformed) {
      const spd = MOVE_SPEED * this.speedMultiplier
      body.setVelocityY(this.isFloating ? -spd : this.isFlyingDown ? spd : 0)
      body.setGravityY(0)
      this.updateAnimation()
      return
    }
    body.setGravityY(this.isFloating ? FLOAT_GRAVITY * this.speedMultiplier : 0)
    if (body.blocked.down) this.isFloating = false
    this.updateAnimation()
  }

  private updateAnimation() {
    if (!this.animPrefix) return
    if (this.isTruck || this.isTrex || this.isDinoForm || this.isConradTransformed || this.isTransforming || this.isShadowForm || this.isSpindashing) return  // managed externally
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
