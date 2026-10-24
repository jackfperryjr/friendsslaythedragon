import Phaser from 'phaser'
import { Destructible } from '../Destructible'
import { DamageType } from '../../types'
import type { InputFrame } from '../../input/InputReader'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Coco: toggles the shadow costume (spin attacks); in shadow form Down + ability is a spindash. */
export class CocoAbility implements CharacterAbility {
  private cocoSpindashState: 'none' | 'windup' | 'dashing' | 'exit' = 'none'
  private cocoSpinTween: Phaser.Tweens.Tween | null = null
  private cocoDashHitDestructibles = new Set<Destructible>()

  constructor(private g: GameScene, private p: Player) {}

  use() {
    this.handleCocoShadow(this.p)
  }

  /** Down + ability in shadow form is the spindash (handled in update), not a transform toggle. */
  ignoresAbilityPress(input: InputFrame): boolean {
    return this.p.isShadowForm && input.down
  }

  update(input: InputFrame) {
    this.updateCocoShadow(input)
  }

  isRamming(): boolean {
    return this.cocoIsOnAttackFrame(this.p)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private handleCocoShadow(coco: Player) {
    if (!coco.isShadowForm) {
      this.transformCocoIn(coco)
    } else if (!coco.isSpindashing && this.cocoSpindashState === 'none') {
      // Never reached with Down held: ignoresAbilityPress() leaves Down + ability to the spindash
      this.transformCocoOut(coco)
    }
  }

  private transformCocoIn(coco: Player) {
    if (coco.isShadowForm || coco.isTransforming) return
    coco.isTransforming = true
    coco.play('coco-transform-in', true)
    coco.once('animationcomplete-coco-transform-in', () => {
      if (!coco.active) return
      coco.isShadowForm  = true
      coco.isTransforming = false
      this.cocoSpindashState = 'none'
      coco.play('coco-shadow-idle', true)
    })
  }

  private transformCocoOut(coco: Player) {
    if (!coco.isShadowForm || coco.isTransforming || coco.isSpindashing) return
    this.stopCocoSpin(coco)
    coco.isTransforming = true
    coco.play('coco-transform-out', true)
    coco.once('animationcomplete-coco-transform-out', () => {
      if (!coco.active) return
      coco.isShadowForm   = false
      coco.isSpindashing  = false
      coco.isTransforming = false
      this.cocoSpindashState = 'none'
      coco.play(`char-${coco.charKey}-idle`, true)
    })
  }

  private startCocoSpin(coco: Player, fast: boolean) {
    this.cocoSpinTween?.stop()
    this.cocoSpinTween = this.g.tweens.add({
      targets: coco, angle: coco.flipX ? -360 : 360,
      duration: fast ? 160 : 340, repeat: -1,
    })
  }

  private stopCocoSpin(coco: Player) {
    this.cocoSpinTween?.stop()
    this.cocoSpinTween = null
    coco.setAngle(0)
  }

  private enterCocoSpindash(coco: Player) {
    if (this.cocoSpindashState !== 'none') return
    this.cocoSpindashState = 'windup'
    coco.isSpindashing = true
    this.cocoDashHitDestructibles.clear()
    coco.play('coco-spindash-windup', true)
    coco.once('animationcomplete-coco-spindash-windup', () => {
      if (!coco.active) return
      this.cocoSpindashState = 'dashing'
      coco.play('coco-spindash-dash', true)
      this.startCocoSpin(coco, true)
    })
  }

  private endCocoSpindash(coco: Player) {
    if (this.cocoSpindashState !== 'dashing') return
    this.cocoSpindashState = 'exit'
    this.stopCocoSpin(coco)
    coco.play('coco-spindash-exit', true)
    coco.once('animationcomplete-coco-spindash-exit', () => {
      if (!coco.active) return
      this.cocoSpindashState = 'none'
      coco.isSpindashing = false
      coco.play('coco-shadow-idle', true)
    })
  }

  private updateCocoShadow(input: InputFrame) {
    const coco = this.g.player
    if (coco.charKey !== 'coco' || !coco.isAlive || !coco.isShadowForm) return
    if (coco.isTransforming) return   // transform animation in progress — don't override it

    const body = coco.body as Phaser.Physics.Arcade.Body
    const downHeld    = input.down
    const abilityHeld = input.ability

    switch (this.cocoSpindashState) {
      case 'none': {
        const airborne = !body.blocked.down
        if (airborne && body.velocity.y < -60) {
          if (coco.anims.currentAnim?.key !== 'coco-shadow-jump') coco.play('coco-shadow-jump', true)
        } else if (airborne) {
          if (coco.anims.currentAnim?.key !== 'coco-shadow-fall') coco.play('coco-shadow-fall', true)
        } else {
          if (this.cocoSpinTween) this.stopCocoSpin(coco)
          const animKey = Math.abs(body.velocity.x) > 10 ? 'coco-shadow-walk' : 'coco-shadow-idle'
          if (coco.anims.currentAnim?.key !== animKey) coco.play(animKey, true)
        }
        // Only spin on spindash frames 9-12
        if (airborne) {
          const frameNum = coco.anims.currentFrame?.textureFrame as number ?? -1
          if (frameNum >= 9 && frameNum <= 12) {
            if (!this.cocoSpinTween) this.startCocoSpin(coco, false)
          } else {
            if (this.cocoSpinTween) this.stopCocoSpin(coco)
          }
        }
        // DOWN + ABILITY held while grounded → start windup then dash
        if (downHeld && abilityHeld && body.blocked.down) this.enterCocoSpindash(coco)
        break
      }

      case 'windup':
        break  // animation auto-transitions to 'dashing' on complete

      case 'dashing': {
        // Release ability → exit (wall hits no longer end the dash)
        if (!abilityHeld) { this.endCocoSpindash(coco); break }

        // Amplify horizontal movement to 3× speed
        if (Math.abs(body.velocity.x) > 10)
          body.setVelocityX(Math.sign(body.velocity.x) * 1050)

        // Enemy + boss damage handled by the physics collider in setupCollision (isSpindashing flag).
        // Destroy nearby furniture/chests before the physics collider can stop the player.
        for (const d of this.g.destructibles) {
          if (!d.active || this.cocoDashHitDestructibles.has(d)) continue
          if (Phaser.Math.Distance.Between(coco.x, coco.y, d.x, d.y) < 72) {
            this.cocoDashHitDestructibles.add(d)
            d.takeDamage(100, DamageType.Physical)
          }
        }
        break
      }

      case 'exit':
        break  // animationcomplete handler in endCocoSpindash takes over
    }
  }

  private cocoIsOnAttackFrame(player: Player): boolean {
    if (player.charKey !== 'coco' || !player.isShadowForm) return false
    const frame = player.anims.currentFrame?.textureFrame
    return typeof frame === 'number' && frame >= 10 && frame <= 12
  }
}
