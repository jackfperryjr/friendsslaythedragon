import Phaser from 'phaser';
import { ROOMS_PER_RUN, WORLD_NAMES } from '../levels';
const FONT = '"Press Start 2P", monospace';
export class LevelCompleteScene extends Phaser.Scene {
    constructor() { super({ key: 'LevelCompleteScene' }); }
    create() {
        const { width, height } = this.scale;
        const levelNum = this.registry.get('currentLevel') ?? 1;
        const roomNum = this.registry.get('currentRoom') ?? 1;
        const isBossRoom = roomNum >= ROOMS_PER_RUN;
        const isLastLevel = levelNum >= 3 && isBossRoom;
        const worldName = WORLD_NAMES[levelNum - 1] ?? '';
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
        const icon = this.add.image(width / 2, height * 0.22, 'goal-portal').setScale(1.8);
        this.tweens.add({ targets: icon, rotation: Math.PI * 2, duration: 3000, repeat: -1, ease: 'Linear' });
        const clearText = isBossRoom ? 'WORLD CLEAR!' : 'ROOM CLEAR!';
        this.add.text(width / 2, height * 0.40, clearText, {
            fontSize: '26px', fontFamily: FONT, color: '#ffe066',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5);
        this.add.text(width / 2, height * 0.54, worldName, {
            fontSize: '12px', fontFamily: FONT, color: '#aaccdd',
        }).setOrigin(0.5);
        const nextLabel = isLastLevel ? 'YOU WIN!' : isBossRoom ? 'NEXT WORLD' : 'NEXT ROOM';
        const btn = this.add.text(width / 2, height * 0.70, nextLabel, {
            fontSize: '16px', fontFamily: FONT, color: '#ffffff',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000055', padding: { x: 20, y: 12 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setColor('#ffe066'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        const advance = () => {
            if (isLastLevel) {
                this.registry.set('currentLevel', 1);
                this.registry.set('currentRoom', 1);
                this.registry.set('roomSequence', null);
                this.scene.start('MenuScene');
            }
            else if (isBossRoom) {
                this.registry.set('currentLevel', levelNum + 1);
                this.registry.set('currentRoom', 1);
                this.registry.set('roomSequence', null);
                this.cameras.main.fadeOut(400, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
            }
            else {
                this.registry.set('currentRoom', roomNum + 1);
                this.cameras.main.fadeOut(400, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
            }
        };
        btn.on('pointerdown', advance);
        this.input.keyboard?.once('keydown-SPACE', advance);
        this.input.keyboard?.once('keydown-ENTER', advance);
        this.input.gamepad?.once(Phaser.Input.Gamepad.Events.BUTTON_DOWN, (_pad, button) => {
            if (button.index === 0)
                advance();
        });
    }
}
