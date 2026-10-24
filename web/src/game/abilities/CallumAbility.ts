import Phaser from 'phaser'
import { Enemy } from '../Enemy'
import { Boss } from '../Boss'
import { SoundManager } from '../../audio/SoundManager'

const FONT = '"Press Start 2P", monospace'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Callum: summons a line of numbers 1-10 that block enemies, then fly at the nearest one. */
export class CallumAbility implements CharacterAbility {
  private callumNumbers: { obj: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Text; emitter: Phaser.GameObjects.Particles.ParticleEmitter }[] = []

  constructor(private g: GameScene, private p: Player) {}

  use() {
    this.spawnCallumNumber(this.p)
  }

  update() {
    this.updateCallumNumbers()
  }

  // ── internals ────────────────────────────────────────────────────────────

  private spawnCallumNumber(src: Player) {
    // Don't stack if a line is already active
    if (this.callumNumbers.length > 0) return
    src.swingMelee()

    const COUNT   = 10
    const SPACING = 56
    // Spawn at foot level so numbers sit on the surface the player is standing on
    const lineY   = src.y + 28
    const startX  = src.x - ((COUNT - 1) * SPACING) / 2
    const palette = ['#ff6666','#ffdd44','#44ff88','#44ccff','#ff88ff',
                     '#ff9944','#aaffff','#ffffff','#ffaacc','#aaffaa']

    for (let i = 0; i < COUNT; i++) {
      const numX   = startX + i * SPACING
      const numVal = i + 1
      const color  = palette[i]

      const glow = this.g.add.text(numX, lineY, `${numVal}`, {
        fontSize: '46px', fontFamily: FONT, color: '#ffffff',
        stroke: '#ffffff', strokeThickness: 10,
      }).setOrigin(0.5).setDepth(11).setAlpha(0.40)
      glow.setTint(0xaa00ff, 0x0088ff, 0xff0077, 0xffaa00)
      this.g.tweens.add({ targets: glow, alpha: 0.12, duration: 600 + i * 60, yoyo: true, repeat: -1 })

      const num = this.g.add.text(numX, lineY, `${numVal}`, {
        fontSize: '42px', fontFamily: FONT, color,
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(12)

      this.g.physics.add.existing(num)
      const body = num.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setVelocity(0, 0)

      const emitter = this.g.add.particles(numX, lineY, '__DEFAULT', {
        lifespan: { min: 300, max: 600 },
        speed: { min: 10, max: 40 },
        scale: { start: 0.25, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffd700, 0xffffff, 0xccaaff, 0x88ddff],
        quantity: 1, frequency: 120, blendMode: 'ADD',
      }).setDepth(13)

      let didHit = false
      const cleanup = () => {
        if (!num.active) return
        emitter.destroy()
        if (glow.active) glow.destroy()
        this.g.tweens.add({
          targets: num, alpha: 0, scaleX: 1.5, scaleY: 1.5,
          duration: 160, onComplete: () => { if (num.active) num.destroy() },
        })
      }

      const onHit = (targetObj: Enemy | Boss) => {
        if (didHit || !num.active) return
        if (targetObj === this.g.boss || targetObj === this.g.boss2) {
          // Numbers pass through a boss that can't be hurt yet
          if (!this.g.bossIsVulnerable(targetObj as Boss)) return
          this.g.damageBoss(targetObj as Boss)
        } else {
          if ((targetObj as Enemy).isDead) return
          SoundManager.enemyHit()
          this.g.hitEnemy(targetObj as Enemy)
        }
        didHit = true
        cleanup()
      }

      // Phase 1 (3 s): numbers sit in line; any enemy walking into them takes a hit
      this.g.enemies.forEach(e => {
        if (e.active) this.g.physics.add.overlap(num, e, () => onHit(e))
      })
      if (this.g.boss?.active) {
        this.g.physics.add.overlap(num, this.g.boss, () => onHit(this.g.boss!))
      }
      if (this.g.boss2?.active) {
        this.g.physics.add.overlap(num, this.g.boss2, () => onHit(this.g.boss2!))
      }

      // Phase 2: after 1.5 s, each number shoots toward nearest enemy
      this.g.time.delayedCall(1500, () => {
        if (!num.active || didHit) return
        body.setBounce(1, 1)
        body.setCollideWorldBounds(true)

        const target = this.g.nearestTarget(num.x, num.y, Infinity)
        if (target) {
          const angle = Phaser.Math.Angle.Between(num.x, num.y, target.x, target.y)
          body.setVelocity(Math.cos(angle) * 680, Math.sin(angle) * 680)
        }
      })

      // Total lifetime cap: 7 s
      this.g.time.delayedCall(7000, () => {
        if (num.active && !didHit) cleanup()
      })

      this.callumNumbers.push({ obj: num, glow, emitter })
    }
  }

  private updateCallumNumbers() {
    this.callumNumbers = this.callumNumbers.filter(n => n.obj.active)
    for (const n of this.callumNumbers) {
      n.emitter.setPosition(n.obj.x, n.obj.y)
      if (n.glow.active) n.glow.setPosition(n.obj.x, n.obj.y)
    }
  }
}
