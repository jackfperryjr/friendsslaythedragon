export enum GameState {
  Playing = 'Playing',
  Paused = 'Paused',
}

export enum AbilityType {
  None = 'None',
  Fire = 'Fire',
  Lightning = 'Lightning',
  Ice = 'Ice',
  Bat = 'Bat',
  BlackDragon = 'BlackDragon',
}

export enum DamageType {
  Physical = 'Physical',
  Fire = 'Fire',
  Explosion = 'Explosion',
  Lightning = 'Lightning',
}

export interface PlayerConfig {
  id: number
  inputType: 'keyboard' | 'gamepad' | 'touch'
  keyboardIndex?: number
}
