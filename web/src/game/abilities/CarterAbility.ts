import Phaser from 'phaser'
import { CarterDuplicate } from '../CarterDuplicate'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Carter: transforms into a laser-shooting dinosaur (or spawns duplicates), with a force field that pulses every 5 s. */
export class CarterAbility implements CharacterAbility {
  private carterDuplicates: CarterDuplicate[] = []
  private carterDinoSpinTween:   Phaser.Tweens.Tween | null = null

  constructor(private g: GameScene, private p: Player) {
    this.startCarterForceField(p)
  }

  use() {
    const p = this.p
    if (p.carterAbility === 'dino') {
      if (p.isDinoForm) this.untransformCarterFromDino(p)
      else this.transformCarterToDino(p)
    } else {
      this.spawnCarterDuplicate(p)
    }
  }

  melee(): boolean {
    if (!this.p.isDinoForm) return false
    this.fireCarterDinoMeleeLaser(this.p)
    return true
  }

  update() {
    this.updateCarterForceField()
    this.updateCarterDino()
  }

  isRamming(): boolean {
    return this.carterDinoIsOnAttackFrame(this.p)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private transformCarterToDino(carter: Player) {
    if (carter.isDinoForm || carter.isTransforming) return
    carter.isTransforming = true
    carter.setTexture('sheet-carter-transform', 0)
    carter.play('carter-transform-in', true)
    carter.once('animationcomplete-carter-transform-in', () => {
      if (!carter.active) return
      carter.isDinoForm     = true
      carter.isTransforming = false
      carter.speedMultiplier = 2.0
      carter.play('carter-dino-idle', true)
    })
  }

  private untransformCarterFromDino(carter: Player) {
    if (!carter.isDinoForm || carter.isTransforming) return
    carter.isDinoForm = false
    this.stopCarterDinoSpin(carter)
    carter.speedMultiplier = 1.0
    carter.isTransforming  = true
    carter.setTexture('sheet-carter-transform', 7)
    carter.play('carter-transform-out', true)
    carter.once('animationcomplete-carter-transform-out', () => {
      if (!carter.active) return
      carter.isTransforming = false
      carter.setTexture(`sheet-${carter.charKey}`, 0)
      carter.play(`char-${carter.charKey}-idle`, true)
    })
  }

  private updateCarterDino() {
    const carter = this.g.player
    if (carter.charKey !== 'carter' || !carter.isAlive || !carter.isDinoForm) return
    if (carter.isTransforming) return

    const body    = carter.body as Phaser.Physics.Arcade.Body
    const airborne = !body.blocked.down

    if (airborne) {
      if (body.velocity.y < -60) {
        if (carter.anims.currentAnim?.key !== 'carter-dino-jump') carter.play('carter-dino-jump', true)
      } else if (body.velocity.y > 80) {
        if (carter.anims.currentAnim?.key !== 'carter-dino-fall') {
          carter.setTexture('sheet-carter-dino-jump')
          carter.play('carter-dino-fall', true)
        }
      } else {
        if (carter.anims.currentAnim?.key !== 'carter-dino-float') {
          carter.setTexture('sheet-carter-dino-jump')
          carter.play('carter-dino-float', true)
        }
      }

      // Spin while on frames 5-9 of the dino-jump sheet
      const frame = carter.anims.currentFrame?.textureFrame as number ?? -1
      if (frame >= 5 && frame <= 9) {
        if (!this.carterDinoSpinTween) this.startCarterDinoSpin(carter)
      } else {
        if (this.carterDinoSpinTween) this.stopCarterDinoSpin(carter)
      }
    } else {
      // Landed — restore transform sheet for idle/walk
      if (this.carterDinoSpinTween) this.stopCarterDinoSpin(carter)
      if (carter.texture.key !== 'sheet-carter-transform') carter.setTexture('sheet-carter-transform')
      const moving = Math.abs(body.velocity.x) > 10
      const key    = moving ? 'carter-dino-walk' : 'carter-dino-idle'
      if (carter.anims.currentAnim?.key !== key) carter.play(key, true)
    }
  }

  private startCarterDinoSpin(carter: Player) {
    this.carterDinoSpinTween?.stop()
    this.carterDinoSpinTween = this.g.tweens.add({
      targets: carter, angle: carter.flipX ? -360 : 360,
      duration: 280, repeat: -1,
    })
  }

  private stopCarterDinoSpin(carter: Player) {
    this.carterDinoSpinTween?.stop()
    this.carterDinoSpinTween = null
    carter.setAngle(0)
  }

  private carterDinoIsOnAttackFrame(player: Player): boolean {
    if (player.charKey !== 'carter' || !player.isDinoForm) return false
    const frame = player.anims.currentFrame?.textureFrame
    return typeof frame === 'number' && frame >= 5 && frame <= 9
  }

  private fireCarterDinoMeleeLaser(carter: Player) {
    const RANGE = 500
    const target = this.g.nearestTarget(carter.x, carter.y, RANGE, true)
    if (!target) return

    const tx   = target.x
    const ty   = target.y - 20
    const eyeX = carter.x + (carter.flipX ? -14 : 14)
    const eyeY = carter.y - 20

    const gfx = this.g.add.graphics().setDepth(15)
    gfx.lineStyle(6, 0xff2200, 0.85)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    gfx.lineStyle(12, 0xff6600, 0.30)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    this.g.tweens.add({ targets: gfx, alpha: 0, duration: 250, onComplete: () => gfx.destroy() })

    const flash = this.g.add.circle(tx, ty, 12, 0xff2200, 1).setDepth(16)
    this.g.tweens.add({ targets: flash, alpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 200, ease: 'Power2', onComplete: () => flash.destroy() })
    const sparkColors = [0xff0000, 0xff4400, 0xff8800, 0xffcc44]
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      const speed = 55 + Math.random() * 75
      const spark = this.g.add.rectangle(tx, ty, 5, 5, sparkColors[i % sparkColors.length], 1).setDepth(16)
      this.g.tweens.add({
        targets: spark,
        x: tx + Math.cos(angle) * speed,
        y: ty + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 230 + Math.random() * 130,
        ease: 'Quad.Out',
        onComplete: () => spark.destroy(),
      })
    }

    this.g.hitTarget(target, carter, 2)
  }

  private startCarterForceField(p: Player) {
    const activate = () => {
      if (!p.active || !p.isAlive) return
      p.setData('carterFF', true)
      p.setData('carterFFStart', this.g.time.now)
      p.invulnerabilityActive = true
      this.g.time.delayedCall(2000, () => {
        if (!p.active) return
        p.setData('carterFF', false)
        // Stay invulnerable if a real invincibility boost is running
        if (p.boostTimeLeft('invuln') === 0) p.invulnerabilityActive = false
      })
    }
    // First pulse fires immediately on spawn; subsequent pulses every 5 s
    this.g.time.delayedCall(300, activate)
    this.g.time.addEvent({ delay: 5000, loop: true, callback: activate })
  }

  private updateCarterForceField() {
    const FF_R = 75
    const p = this.g.player
    if (p.charKey !== 'carter' || !p.isAlive || !p.getData('carterFF')) return
    const inRange = (t: { x: number; y: number }) => Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y) < FF_R
    this.g.enemies.forEach(e => { if (this.g.isTargetable(e) && inRange(e)) e.die() })
    for (const b of [this.g.boss, this.g.boss2]) if (b?.active && inRange(b)) this.g.damageBoss(b)
  }

  private spawnCarterDuplicate(src: Player) {
    const sheet = `sheet-${src.charKey}`
    if (!this.g.textures.exists(sheet)) return
    const dup = new CarterDuplicate(this.g, src.x, src.y, sheet)
    dup.setFlipX(src.flipX)
    this.carterDuplicates.push(dup)
    this.g.physics.add.collider(dup, this.g.platforms)
    this.g.tilemapLayers.forEach(l => this.g.physics.add.collider(dup, l))
    this.g.enemies.forEach(e => {
      this.g.physics.add.overlap(dup, e, () => dup.hit())
    })
    if (this.g.boss?.active)  this.g.physics.add.overlap(dup, this.g.boss,  () => dup.hit())
    if (this.g.boss2?.active) this.g.physics.add.overlap(dup, this.g.boss2, () => dup.hit())
    dup.on('fireLaser', (d: CarterDuplicate) => this.fireDuplicateLaser(d))
    dup.on('duplicateDied', (d: CarterDuplicate) => {
      this.carterDuplicates = this.carterDuplicates.filter(x => x !== d)
    })
  }

  private fireDuplicateLaser(dup: CarterDuplicate) {
    if (!dup.active) return

    const target = this.g.nearestTarget(dup.x, dup.y, 800)
    if (!target) return

    const tx = target.x
    const ty = target.y - 20
    const eyeX = dup.x + (dup.flipX ? -8 : 8)
    const eyeY = dup.y - 18

    const gfx = this.g.add.graphics().setDepth(15)
    gfx.lineStyle(6, 0xff2200, 0.85)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    gfx.lineStyle(12, 0xff6600, 0.3)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    this.g.tweens.add({ targets: gfx, alpha: 0, duration: 250, onComplete: () => gfx.destroy() })

    // Red explosion at impact point
    const flash = this.g.add.circle(tx, ty, 12, 0xff2200, 1).setDepth(16)
    this.g.tweens.add({ targets: flash, alpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 200, ease: 'Power2', onComplete: () => flash.destroy() })
    const sparkColors = [0xff0000, 0xff4400, 0xff8800, 0xffcc44]
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      const speed = 55 + Math.random() * 75
      const spark = this.g.add.rectangle(tx, ty, 5, 5, sparkColors[i % sparkColors.length], 1).setDepth(16)
      this.g.tweens.add({
        targets: spark,
        x: tx + Math.cos(angle) * speed,
        y: ty + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 230 + Math.random() * 130,
        ease: 'Quad.Out',
        onComplete: () => spark.destroy(),
      })
    }

    this.g.hitTarget(target, this.g.player)
  }
}
