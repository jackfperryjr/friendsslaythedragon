import Phaser from 'phaser';
const FONT = '"Press Start 2P", monospace';
export class GameOverScene extends Phaser.Scene {
    gpCursor;
    menuItems = [];
    focusIdx = 0;
    _navStickHeld = false;
    _prevBtns = [];
    constructor() { super({ key: 'GameOverScene' }); }
    create() {
        const { width, height } = this.scale;
        const cx = width / 2, cy = height / 2;
        this.cameras.main.setBackgroundColor('#050004');
        this.cameras.main.fadeIn(600, 0, 0, 0);
        this.gpCursor = this.add.text(0, 0, '►', {
            fontSize: '14px', fontFamily: FONT, color: '#ff6666',
        }).setOrigin(1, 0.5).setDepth(20).setVisible(false);
        this.spawnStars(width, height);
        this.buildUI(cx, cy);
    }
    update() {
        const pad = this.input.gamepad?.getPad(0);
        if (!pad?.connected)
            return;
        const just = (i) => {
            const cur = pad.buttons[i]?.pressed ?? false;
            const was = this._prevBtns[i] ?? false;
            this._prevBtns[i] = cur;
            return cur && !was;
        };
        if (just(12) || just(14))
            this.moveFocus(-1);
        if (just(13) || just(15))
            this.moveFocus(1);
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
        for (let i = 0; i < 80; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const sz = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1;
            const star = this.add.rectangle(x, y, sz, sz, 0xffffff, 0.3 + Math.random() * 0.4);
            this.tweens.add({
                targets: star, alpha: { from: 0.03, to: 0.7 },
                duration: 800 + Math.random() * 1800, yoyo: true, repeat: -1,
                delay: Math.random() * 2000,
            });
        }
    }
    buildUI(cx, cy) {
        // Title
        const title = this.add.text(cx, cy - 240, 'GAME OVER', {
            fontSize: '52px', fontFamily: FONT, color: '#ff3333',
            stroke: '#000000', strokeThickness: 12,
        }).setOrigin(0.5).setAlpha(0);
        const sep = this.add.rectangle(cx, cy + 20, 400, 1, 0x551122, 0).setOrigin(0.5);
        const btnAgain = this.menuButton(cx - 165, cy + 115, 'TRY AGAIN').setAlpha(0);
        const btnMenu = this.menuButton(cx + 165, cy + 115, 'MAIN MENU').setAlpha(0);
        const resetAndPlay = () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.registry.set('runRooms', null);
                this.registry.set('runIndex', 0);
                this.registry.set('entryDir', null);
                this.registry.set('persistedAbilities', null);
                this.registry.set('persistedHearts', null);
                this.registry.set('lives', 3);
                this.scene.start('GameScene');
            });
        };
        const goMenu = () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.registry.set('runRooms', null);
                this.registry.set('runIndex', 0);
                this.registry.set('entryDir', null);
                this.registry.set('persistedAbilities', null);
                this.registry.set('persistedHearts', null);
                this.scene.start('MenuScene');
            });
        };
        btnAgain.on('pointerdown', resetAndPlay);
        btnMenu.on('pointerdown', goMenu);
        this.menuItems = [
            { text: btnAgain, action: () => btnAgain.emit('pointerdown') },
            { text: btnMenu, action: () => btnMenu.emit('pointerdown') },
        ];
        // Animation sequence
        this.tweens.add({
            targets: title,
            y: cy - 195, alpha: 1,
            duration: 800, ease: 'Back.Out', delay: 250,
            onComplete: () => {
                this.tweens.add({
                    targets: title, alpha: 0.82,
                    duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut',
                });
                this.tweens.add({
                    targets: sep, alpha: 0.55, duration: 400, delay: 350,
                    onComplete: () => {
                        this.tweens.add({ targets: [btnAgain, btnMenu], alpha: 1, duration: 400, delay: 150 });
                    },
                });
            },
        });
        // Brief red flash on entry
        this.time.delayedCall(200, () => {
            const flash = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0xff0000, 0.22)
                .setDepth(30);
            this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
        });
    }
    menuButton(x, y, label) {
        const btn = this.add.text(x, y, label, {
            fontSize: '14px', fontFamily: FONT, color: '#ffffff',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000055', padding: { x: 18, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setColor('#ff8888'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        return btn;
    }
}
