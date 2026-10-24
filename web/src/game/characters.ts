/**
 * What each character's ABILITY button does, shown on the character select
 * screen. Keep these in sync with GameScene.handleCharacterAbility().
 * Button names are generic (ability / melee / shield / down) because the keys
 * differ between keyboard, gamepad and touch.
 */
export const CHARACTER_ABILITIES: Record<string, string[]> = {
  conrad:   ['ABILITY: become a flying jet.', 'MELEE fires lasers, SHIELD calls in a tank, truck or helicopter.'],
  carter:   ['ABILITY: turn into a speedy dinosaur that shoots lasers.', 'A force field also zaps nearby enemies every few seconds.'],
  callum:   ['ABILITY: summon the numbers 1 to 10.', 'They block enemies, then fly off to hit the nearest one.'],
  coco:     ['ABILITY: put on the shadow costume and spin through enemies.', 'In shadow form, hold DOWN + ABILITY to spindash.'],
  eric:     ['ABILITY: turn into a truck.', 'Run enemies over and take no damage.'],
  abby:     ['ABILITY: grow huge and spin for 5 seconds,', 'flattening every enemy and crate you touch.'],
  scarlett: ['ABILITY: become a T-rex', 'and stomp straight through enemies.'],
}
