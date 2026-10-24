import Phaser from 'phaser'
import { SoundManager } from './audio/SoundManager'
import { BootScene } from './scenes/BootScene'
import { IntroScene } from './scenes/IntroScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { VictoryScene } from './scenes/VictoryScene'
import { GameOverScene } from './scenes/GameOverScene'
import { CharacterSelectScene } from './scenes/CharacterSelectScene'
import { BackgroundLoaderScene } from './scenes/BackgroundLoaderScene'
import { loadSettings, setSoundMuted } from './game/settings'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#080818',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 800 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
    activePointers: 4,
  },
  scene: [BootScene, IntroScene, MenuScene, CharacterSelectScene, GameScene, VictoryScene, GameOverScene, BackgroundLoaderScene],
}

// iOS/Safari requires a user gesture before the Gamepad API and AudioContext
// are accessible. Unlock both on the first interaction of any kind.
let _audioUnlocked = false
const unlockOnGesture = () => {
  if (_audioUnlocked) return
  _audioUnlocked = true
  try { navigator.getGamepads() } catch (_) { /* ignore */ }
  SoundManager.unlock()
}
document.addEventListener('touchstart', unlockOnGesture, { passive: true })
document.addEventListener('pointerdown', unlockOnGesture, { passive: true })
document.addEventListener('keydown',    unlockOnGesture)

const game = new Phaser.Game(config)
// Dev server only: lets browser tests and the console reach the game (window.__game)
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game
SoundManager.setMuted(loadSettings().muted, game.sound)

// M mutes / unmutes on any screen
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) setSoundMuted(!SoundManager.isMuted())
})
