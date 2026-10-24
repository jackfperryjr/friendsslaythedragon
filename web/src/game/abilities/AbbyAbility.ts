import Phaser from 'phaser'
import { Enemy } from '../Enemy'
import { Destructible } from '../Destructible'
import { DamageType } from '../../types'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Abby: grows huge and spins for 5 s, flattening enemies and breakables (press again to end early). */
export class AbbyAbility implements CharacterAbility {

  constructor(private g: GameScene, private p: Player) {}

  use() {
    const earlyExit = this.p.getData('abbyEarlyExit') as (() => void) | null
    if (earlyExit) earlyExit()
    else this.handleAbbyTransform(this.p)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private handleAbbyTransform(src: Player) {
    if (src.isTransforming) return
    src.isTransforming = true
    src.stop()  // halt any currently playing animation before manual frame stepping

    const FRAME_MS  = 80    // ms per frame (~12.5 fps)
    const HOLD_MS   = 5000  // 5-second spiral hold on frame 10
    const KILL_R    = 96    // kill radius while at 3× scale (half of 64px frame × 3)
    const origScale = src.scale  // preserve player's default scale (1.3)

    src.setTexture('sheet-abby-transformer', 1)

    let rotTween: Phaser.Tweens.Tween | null = null

    const startRot = (dur: number) => {
      rotTween?.stop()
      rotTween = this.g.tweens.add({ targets: src, angle: '+=360', duration: dur, repeat: -1 })
    }

    // Frames 2-7: advance without rotation
    for (let f = 2; f <= 7; f++) {
      this.g.time.delayedCall((f - 1) * FRAME_MS, () => {
        if (!src.active) return
        src.setFrame(f)
      })
    }

    // Frame 8: rotation begins
    this.g.time.delayedCall(7 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(8)
      startRot(400)
    })

    // Frame 9
    this.g.time.delayedCall(8 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(9)
    })

    // Frame 10: enlarge 3×, raise 10px, hover (no gravity), spin, kill enemies + breakables
    this.g.time.delayedCall(9 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(10)
      src.setScale(3)
      src.setY(src.y - 10)
      startRot(350)

      const body = src.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setVelocityY(0)
      src.setData('abbySpinHold', true)

      const hitSet         = new Set<Enemy>()
      const destroyedBreak = new Set<Destructible>()
      const killTimer = this.g.time.addEvent({
        delay: 20,
        loop: true,
        callback: () => {
          if (!src.active) return
          for (const e of this.g.enemies) {
            if (!e.active || hitSet.has(e)) continue
            if (Phaser.Math.Distance.Between(src.x, src.y, e.x, e.y) < KILL_R) {
              hitSet.add(e)
              e.die()
            }
          }
          for (const d of this.g.destructibles) {
            if (!d.active || destroyedBreak.has(d)) continue
            if (Phaser.Math.Distance.Between(src.x, src.y, d.x, d.y) < KILL_R) {
              destroyedBreak.add(d)
              d.takeDamage(100, DamageType.Physical)
            }
          }
        },
      })

      let reformFired = false
      const doReform = () => {
        if (reformFired) return
        reformFired = true
        holdTimer.remove()
        killTimer.remove()
        body.setAllowGravity(true)
        src.setData('abbySpinHold', false)
        src.setData('abbyEarlyExit', null)

        if (!src.active) {
          rotTween?.stop()
          src.setY(src.y + 10)
          src.setScale(origScale)
          src.setAngle(0)
          src.isTransforming = false
          return
        }

        // Frame 11: restore gravity/position, scale back to normal, rotation continues
        src.setY(src.y + 10)
        src.setScale(origScale)
        src.setFrame(11)
        startRot(400)

        // After frame 11, stop rotation and play reform frames 12-15
        this.g.time.delayedCall(FRAME_MS, () => {
          rotTween?.stop()
          rotTween = null
          src.setAngle(0)

          const reformFrames = [12, 13, 14, 15]
          for (let i = 0; i < reformFrames.length; i++) {
            this.g.time.delayedCall(i * FRAME_MS, () => {
              if (src.active) src.setFrame(reformFrames[i])
            })
          }

          this.g.time.delayedCall(reformFrames.length * FRAME_MS, () => {
            src.setScale(origScale)
            src.setAngle(0)
            src.isTransforming = false
            // updateAnimation() resumes on next tick and restores sheet-abby
          })
        })
      }

      src.setData('abbyEarlyExit', doReform)
      const holdTimer = this.g.time.delayedCall(HOLD_MS, doReform)
    })
  }
}
