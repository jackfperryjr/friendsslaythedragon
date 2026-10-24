import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { InputFrame } from '../../input/InputReader'
import { AbbyAbility } from './AbbyAbility'
import { CallumAbility } from './CallumAbility'
import { CarterAbility } from './CarterAbility'
import { CocoAbility } from './CocoAbility'
import { ConradAbility } from './ConradAbility'
import { EricAbility } from './EricAbility'
import { ScarlettAbility } from './ScarlettAbility'

/**
 * A character's special moves. GameScene creates one for the chosen character
 * and calls into it; everything character-specific lives in these classes.
 *
 * To add a character: write a class implementing this interface, add it to
 * `createAbility()` below, and describe it in game/characters.ts.
 */
export interface CharacterAbility {
  /** ABILITY button pressed. */
  use(): void
  /** MELEE button pressed. Return true if handled, replacing the normal sword swing. */
  melee?(): boolean
  /** While true, the SHIELD button calls shieldPressed() instead of shielding. */
  replacesShield?(): boolean
  shieldPressed?(): void
  /** Return true to skip use() this frame (e.g. a button combo handled in update). */
  ignoresAbilityPress?(input: InputFrame): boolean
  /** Every frame while the game is running. */
  update?(input: InputFrame): void
  /** While true, touching enemies and bosses damages them instead of the player. */
  isRamming?(): boolean
}

/** Characters without a special ability just swing their sword. */
class MeleeOnly implements CharacterAbility {
  constructor(private g: GameScene, private p: Player) {}
  use() { this.g.doMeleeSwing(this.p) }
}

export function createAbility(g: GameScene, p: Player): CharacterAbility {
  switch (p.charKey) {
    case 'abby':     return new AbbyAbility(g, p)
    case 'callum':   return new CallumAbility(g, p)
    case 'carter':   return new CarterAbility(g, p)
    case 'coco':     return new CocoAbility(g, p)
    case 'conrad':   return new ConradAbility(g, p)
    case 'eric':     return new EricAbility(g, p)
    case 'scarlett': return new ScarlettAbility(g, p)
    default:         return new MeleeOnly(g, p)
  }
}
