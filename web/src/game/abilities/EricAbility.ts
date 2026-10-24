import Phaser from 'phaser'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Eric: transforms into a truck that runs enemies over and takes no damage. */
export class EricAbility implements CharacterAbility {

  constructor(_g: GameScene, private p: Player) {}

  use() {
    if (this.p.isTruck) this.untransformEric(this.p)
    else this.transformEricToTruck(this.p)
  }

  /** Drive / idle animation while in truck form (Player.update doesn't know about it). */
  update() {
    const p = this.p
    if (!p.isTruck) return
    const moving = Math.abs((p.body as Phaser.Physics.Arcade.Body).velocity.x) > 10
    const animKey = moving ? 'eric-anim-truck-move' : 'eric-anim-truck-idle'
    if (p.anims.currentAnim?.key !== animKey) p.play(animKey, true)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private transformEricToTruck(player: Player) {
    if (player.isTruck || player.isTransforming) return

    player.isTransforming = true
    player.setTexture('sheet-eric-transformer', 0)
    player.play('eric-anim-transform')

    player.once('animationcomplete-eric-anim-transform', () => {
      if (!player.active) return
      player.isTruck = true
      player.isTransforming = false
      player.play('eric-anim-truck-idle', true)
    })
  }

  private untransformEric(player: Player) {
    if (!player.isTruck || player.isTransforming) return

    player.isTruck = false
    player.isTransforming = true
    player.play('eric-anim-untransform')

    player.once('animationcomplete-eric-anim-untransform', () => {
      if (!player.active) return
      player.isTransforming = false
      // Releasing the lock lets updateAnimation() resume normal eric animations
      // on the next frame, which auto-switches back to sheet-eric via the anim frames
    })
  }
}
