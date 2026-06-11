import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { generateRun } from '../levels';
const FONT = '"Press Start 2P", monospace';
export class VictoryScene extends Phaser.Scene {
    gpCursor;
    menuItems = [];
    focusIdx = 0;
    _navStickHeld = false;
    _prevBtns = [];
    constructor() { super({ key: 'VictoryScene' }); }
    create() {
        const { width, height } = this.scale;
        const cx = width / 2, cy = height / 2;
        this.cameras.main.setBackgroundColor('#000000');
        this.cameras.main.fadeIn(700, 0, 0, 0);
        this.gpCursor = this.add.text(0, 0, '►', {
            fontSize: '14px', fontFamily: FONT, color: '#ffe066',
        }).setOrigin(1, 0.5).setDepth(20).setVisible(false);
        this.spawnStars(width, height);
        this.buildUI(cx, cy);
        SoundManager.stopTrack();
        SoundManager.startVictoryMusic();
        this.events.once('shutdown', () => SoundManager.stopVictoryMusic());
    }
    update() {
        const pad = this.input.gamepad?.getPad(0);
        if (!pad?.connected)
            return;
        // Manual just-pressed: compare current vs previous frame
        const just = (i) => {
            const cur = pad.buttons[i]?.pressed ?? false;
            const was = this._prevBtns[i] ?? false;
            this._prevBtns[i] = cur;
            return cur && !was;
        };
        // D-pad: 12=up, 13=down, 14=left, 15=right
        if (just(12) || just(14))
            this.moveFocus(-1);
        if (just(13) || just(15))
            this.moveFocus(1);
        // Left stick vertical — fallback for D-pad-as-axes on some platforms
        const ly = pad.leftStick.y;
        if (!this._navStickHeld) {
            if (ly < -0.5) {
                this._navStickHeld = true;
                this.moveFocus(-1);
            }
            else if (ly > 0.5) {
                this._navStickHeld = true;
                this.moveFocus(1);
            }
        }
        else if (Math.abs(ly) < 0.25) {
            this._navStickHeld = false;
        }
        // Confirm: Cross (button 0) or Options/Start (button 9)
        if (just(0) || just(9))
            this.menuItems[this.focusIdx]?.action();
    }
    moveFocus(dir) {
        const len = this.menuItems.length;
        if (!len)
            return;
        this.focusIdx = (this.focusIdx + dir + len) % len;
        const b = this.menuItems[this.focusIdx].text.getBounds();
        this.gpCursor.setPosition(b.left - 10, b.centerY).setVisible(true);
    }
    spawnStars(width, height) {
        for (let i = 0; i < 90; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const sz = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1;
            const star = this.add.rectangle(x, y, sz, sz, 0xffffff, 0.4 + Math.random() * 0.5);
            this.tweens.add({
                targets: star, alpha: { from: 0.05, to: 0.95 },
                duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1,
                delay: Math.random() * 2500,
            });
        }
    }
    buildUI(cx, cy) {
        const { height } = this.scale;
        // Title — slides down from above
        const title = this.add.text(cx, cy - 260, 'YOU WIN!', {
            fontSize: '60px', fontFamily: FONT, color: '#ffe066',
            stroke: '#000000', strokeThickness: 12,
        }).setOrigin(0.5).setAlpha(0);
        // Message lines
        const msg1 = this.add.text(cx, cy - 70, 'ALL ENEMIES DEFEATED!', {
            fontSize: '18px', fontFamily: FONT, color: '#ffffff',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
        const msg2 = this.add.text(cx, cy - 30, 'THE DUNGEON IS YOURS!', {
            fontSize: '18px', fontFamily: FONT, color: '#ffb3c6',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
        // Separator
        const sep = this.add.rectangle(cx, cy + 30, 400, 1, 0x334466, 0).setOrigin(0.5);
        // Stats
        const pizzas = this.registry.get('pizzasCollected') ?? 0;
        const furniture = this.registry.get('furnitureDestroyed') ?? 0;
        const coins = this.registry.get('goldCoins') ?? 0;
        const statStyle = { fontSize: '11px', fontFamily: FONT, color: '#aaccff', stroke: '#000', strokeThickness: 3 };
        const valStyle = { fontSize: '11px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 3 };
        const statRows = [];
        const stats = [
            ['PIZZAS EATEN', pizzas],
            ['FURNITURE SMASHED', furniture],
            ['GOLD COINS', coins],
        ];
        stats.forEach(([label, val], i) => {
            const rowY = cy + 60 + i * 38;
            statRows.push(this.add.text(cx - 20, rowY, label + ':', statStyle).setOrigin(1, 0.5).setAlpha(0));
            statRows.push(this.add.text(cx + 20, rowY, String(val), valStyle).setOrigin(0, 0.5).setAlpha(0));
        });
        // Buttons — stacked at bottom centre; Continue on top as primary action
        const btnContinue = this.menuButton(cx, height - 130, 'CONTINUE EXPLORING').setAlpha(0);
        const btnMenu = this.menuButton(cx, height - 70, 'MAIN MENU').setAlpha(0);
        btnMenu.on('pointerdown', () => {
            btnMenu.disableInteractive();
            btnContinue.disableInteractive();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.time.delayedCall(450, () => {
                this.registry.set('runRooms', null);
                this.registry.set('runIndex', 0);
                this.registry.set('entryDir', null);
                this.registry.set('persistedAbilities', null);
                this.registry.set('persistedHearts', null);
                this.registry.set('persistedBoosts', null);
                this.registry.set('score', 0);
                this.registry.set('skeletonKingDefeated', false);
                this.registry.set('zombieKingDefeated', false);
                this.registry.set('celeryManDefeated', false);
                this.registry.set('dadSaved', false);
                this.registry.set('momSaved', false);
                this.registry.set('wormCount', 0);
                this.registry.set('rolyPolyCount', 0);
                this.registry.set('pizzasCollected', 0);
                this.registry.set('furnitureDestroyed', 0);
                this.registry.set('goldCoins', 0);
                this.registry.set('level4Problem1', null);
                this.registry.set('level4Problem2', null);
                this.registry.set('level4Problem3', null);
                this.registry.set('level4Problem1Solved', null);
                this.registry.set('level4Problem2Solved', null);
                this.registry.set('level4Problem3Solved', null);
                [0, 1, 2, 3].forEach(pid => this.registry.set(`level4DuckBoost_${pid}`, null));
                this.registry.set('level5Word', null);
                this.registry.set('level5BugLetters', null);
                this.registry.set('level5BugPositions', null);
                this.registry.set('level5CollectedLetters', null);
                this.registry.set('level5WordSolved', null);
                this.registry.set('level6Word', null);
                this.registry.set('level6BugLetters', null);
                this.registry.set('level6BugPositions', null);
                this.registry.set('level6CollectedLetters', null);
                this.registry.set('level6WordSolved', null);
                this.registry.set('level7Word', null);
                this.registry.set('level7BugLetters', null);
                this.registry.set('level7BugPositions', null);
                this.registry.set('level7CollectedLetters', null);
                this.registry.set('level7WordSolved', null);
                this.scene.start('MenuScene');
            });
        });
        btnContinue.on('pointerdown', () => {
            btnMenu.disableInteractive();
            btnContinue.disableInteractive();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.time.delayedCall(450, () => {
                const rooms = generateRun();
                this.registry.set('runRooms', rooms);
                this.registry.set('runIndex', 5); // BOSS_THREE_ROOM = Celery Man's Lair
                this.registry.set('entryDir', 'left');
                this.registry.set('persistedAbilities', null);
                this.registry.set('persistedHearts', null);
                this.registry.set('lives', 3);
                this.registry.set('score', 0);
                this.registry.set('skeletonKingDefeated', true);
                this.registry.set('zombieKingDefeated', true);
                this.registry.set('celeryManDefeated', true);
                this.registry.set('dadSaved', true);
                this.registry.set('momSaved', true);
                this.registry.set('wormCount', 0);
                this.registry.set('rolyPolyCount', 0);
                this.scene.start('GameScene');
            });
        });
        // Register buttons for gamepad navigation — Continue is index 0 (default focus)
        this.menuItems = [
            { text: btnContinue, action: () => btnContinue.emit('pointerdown') },
            { text: btnMenu, action: () => btnMenu.emit('pointerdown') },
        ];
        // Animation sequence
        this.tweens.add({
            targets: title,
            y: cy - 200, alpha: 1,
            duration: 750, ease: 'Back.Out', delay: 200,
            onComplete: () => {
                // Gentle pulse on title
                this.tweens.add({
                    targets: title, scaleX: 1.03, scaleY: 1.03,
                    duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut',
                });
                this.tweens.add({ targets: msg1, alpha: 1, duration: 400, delay: 150 });
                this.tweens.add({
                    targets: msg2, alpha: 1, duration: 400, delay: 350,
                    onComplete: () => {
                        this.tweens.add({ targets: sep, alpha: 0.5, duration: 500 });
                        this.tweens.add({ targets: statRows, alpha: 1, duration: 400, delay: 100 });
                        this.tweens.add({ targets: [btnContinue, btnMenu], alpha: 1, duration: 400, delay: 300 });
                    },
                });
            },
        });
        // Burst of particles on entry (simple circles flying outward)
        this.time.delayedCall(250, () => this.fireBurst(cx, cy - 200));
    }
    fireBurst(cx, cy) {
        const colors = [0xffe066, 0xff80ab, 0x80d8ff, 0xffffff, 0xffaa00];
        for (let i = 0; i < 28; i++) {
            const angle = (i / 28) * Math.PI * 2;
            const speed = 160 + Math.random() * 180;
            const c = this.add.rectangle(cx, cy, 5, 5, Phaser.Math.RND.pick(colors), 1);
            this.tweens.add({
                targets: c,
                x: cx + Math.cos(angle) * speed * (1.5 + Math.random()),
                y: cy + Math.sin(angle) * speed * (0.6 + Math.random()),
                alpha: 0, scaleX: 0.3, scaleY: 0.3,
                duration: 900 + Math.random() * 400,
                ease: 'Quad.Out',
                onComplete: () => c.destroy(),
            });
        }
    }
    menuButton(x, y, label) {
        const btn = this.add.text(x, y, label, {
            fontSize: '14px', fontFamily: FONT, color: '#ffffff',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000055', padding: { x: 18, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setColor('#ffe066'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        return btn;
    }
}
