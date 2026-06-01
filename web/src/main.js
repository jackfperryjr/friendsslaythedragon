import Phaser from 'phaser';
import { SoundManager } from './audio/SoundManager';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { VictoryScene } from './scenes/VictoryScene';
import { GameOverScene } from './scenes/GameOverScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { LobbyScene } from './scenes/LobbyScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#080818',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 800 }, debug: false },
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
        gamepad: true,
    },
    scene: [BootScene, IntroScene, MenuScene, CharacterSelectScene, GameScene, VictoryScene, GameOverScene, LevelCompleteScene, LobbyScene],
};
// iOS/Safari requires a user gesture before the Gamepad API and AudioContext
// are accessible. Unlock both on the first interaction of any kind.
let _audioUnlocked = false;
const unlockOnGesture = () => {
    if (_audioUnlocked)
        return;
    _audioUnlocked = true;
    try {
        navigator.getGamepads();
    }
    catch (_) { /* ignore */ }
    SoundManager.unlock();
};
document.addEventListener('touchstart', unlockOnGesture, { passive: true });
document.addEventListener('pointerdown', unlockOnGesture, { passive: true });
document.addEventListener('keydown', unlockOnGesture);
new Phaser.Game(config);
