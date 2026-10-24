import Phaser from 'phaser'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Scarlett: transforms into a T-rex that stomps through enemies. */
export class ScarlettAbility implements CharacterAbility {

  constructor(_g: GameScene, private p: Player) {}

  use() {
    if (this.p.isTrex) this.untransformScarlett(this.p)
    else this.transformScarlettToTrex(this.p)
  }

  /** Walk / idle animation while in T-rex form (Player.update doesn't know about it). */
  update() {
    const p = this.p
    if (!p.isTrex) return
    const moving = Math.abs((p.body as Phaser.Physics.Arcade.Body).velocity.x) > 10
    const animKey = moving ? 'trex-walk' : 'trex-idle'
    if (p.anims.currentAnim?.key !== animKey) p.play(animKey, true)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private transformScarlettToTrex(player: Player) {
    if (player.isTrex || player.isTransforming) return
    player.isTransforming = true
    player.setTexture('sheet-scarlett-transformer', 0)
    player.play('scarlett-anim-transform')
    player.once('animationcomplete-scarlett-anim-transform', () => {
      if (!player.active) return
      player.isTrex = true
      player.isTransforming = false
      player.setTexture('sheet-trex', 0)
      player.play('trex-idle', true)
    })
  }

  private untransformScarlett(player: Player) {
    if (!player.isTrex || player.isTransforming) return
    player.isTrex = false
    player.isTransforming = true
    player.setTexture('sheet-scarlett-transformer', 0)
    player.play('scarlett-anim-untransform')
    player.once('animationcomplete-scarlett-anim-untransform', () => {
      if (!player.active) return
      player.isTransforming = false
    })
  }
}
