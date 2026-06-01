import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { SoundManager } from '../audio/SoundManager';
const FONT = '"Press Start 2P", monospace';
const PLAYER_COLORS = [0xffe066, 0x00ccff, 0x44ff88, 0xff8c00];
const PLAYER_COLOR_STR = ['#ffe066', '#00ccff', '#44ff88', '#ff8c00'];
// 7 characters fit in two rows: 4 top, 3 bottom (centered)
const CARD_W = 148;
const CARD_H = 190;
const GAP = 16;
export class CharacterSelectScene extends Phaser.Scene {
    chars = [];
    playerCount = 1;
    localPlayerId = 0;
    isMultiplayer = false;
    selections = [];
    confirmed = [];
    cursors = [];
    confirmMarks = [];
    playerLabels = [];
    cards = [];
    startText;
    backBtn;
    backCursor;
    backFocused = false;
    started = false;
    constructor() { super({ key: 'CharacterSelectScene' }); }
    create() {
        SoundManager.whenUnlocked(() => SoundManager.startTrack(this.sound, 'music-title'));
        const { width, height } = this.scale;
        this.started = false;
        this.playerCount = this.registry.get('playerCount') ?? 1;
        this.localPlayerId = this.registry.get('localPlayerId') ?? 0;
        this.isMultiplayer = this.registry.get('networkManager') != null;
        this.chars = BootScene.getSelectableCharacters();
        this.selections = Array(this.playerCount).fill(0);
        this.confirmed = Array(this.playerCount).fill(false);
        this.add.rectangle(width / 2, height / 2, width, height, 0x080818);
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0030, 0.45);
        this.add.text(width / 2, 44, 'CHOOSE YOUR CHARACTER', {
            fontSize: '16px', fontFamily: FONT, color: '#ffe066',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5);
        // Layout: row0 = first 4 chars, row1 = remaining chars (centered)
        this.cards = [];
        const rowSplit = 4;
        const row0Count = Math.min(this.chars.length, rowSplit);
        const row1Count = Math.max(0, this.chars.length - rowSplit);
        const row0Y = Math.round(height * 0.38);
        const row1Y = Math.round(height * 0.38) + CARD_H + GAP + 10;
        const buildRow = (startIdx, count, rowY) => {
            const rowW = count * CARD_W + (count - 1) * GAP;
            const rowX = (width - rowW) / 2 + CARD_W / 2;
            for (let i = 0; i < count; i++) {
                const ci = startIdx + i;
                const cx = Math.round(rowX + i * (CARD_W + GAP));
                this.cards[ci] = { x: cx, y: rowY };
                this.buildCard(cx, rowY, this.chars[ci]);
                // Touch / click — tap once to select, tap again to confirm
                const zone = this.add.zone(cx, rowY, CARD_W, CARD_H).setInteractive().setDepth(8);
                zone.on('pointerdown', () => {
                    if (this.started)
                        return;
                    // In multiplayer each device only controls its own slot
                    const p = this.isMultiplayer
                        ? this.localPlayerId
                        : this.confirmed.indexOf(false);
                    if (p < 0 || this.confirmed[p])
                        return;
                    if (this.selections[p] === ci) {
                        this.confirm(p);
                    }
                    else {
                        this.selections[p] = ci;
                        this.updateCursorPos(p);
                    }
                });
            }
        };
        buildRow(0, row0Count, row0Y);
        if (row1Count > 0)
            buildRow(row0Count, row1Count, row1Y);
        // Per-player cursors, labels, confirm marks
        this.cursors = [];
        this.confirmMarks = [];
        this.playerLabels = [];
        for (let p = 0; p < this.playerCount; p++) {
            const cursor = this.add.rectangle(0, 0, CARD_W + 10, CARD_H + 10, 0, 0)
                .setStrokeStyle(3, PLAYER_COLORS[p])
                .setDepth(5);
            this.cursors.push(cursor);
            const label = this.add.text(0, 0, `P${p + 1}`, {
                fontSize: '8px', fontFamily: FONT, color: PLAYER_COLOR_STR[p],
                backgroundColor: '#00000099', padding: { x: 4, y: 2 },
            }).setOrigin(0.5, 1).setDepth(6);
            this.playerLabels.push(label);
            const mark = this.add.text(0, 0, '✓', {
                fontSize: '13px', fontFamily: FONT, color: PLAYER_COLOR_STR[p],
                stroke: '#000', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(7).setVisible(false);
            this.confirmMarks.push(mark);
            this.updateCursorPos(p);
        }
        // Status text
        this.startText = this.add.text(width / 2, height - 72, '', {
            fontSize: '10px', fontFamily: FONT, color: '#556677',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);
        this.updateStartText();
        this.backBtn = this.add.text(width / 2, height - 38, '< BACK', {
            fontSize: '10px', fontFamily: FONT, color: '#7799aa',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#00000044', padding: { x: 18, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);
        this.backCursor = this.add.text(0, height - 38, '►', {
            fontSize: '10px', fontFamily: FONT, color: '#ffe066',
        }).setOrigin(1, 0.5).setDepth(10).setVisible(false);
        this.backBtn.on('pointerover', () => this.backBtn.setStyle({ color: '#ffffff' }));
        this.backBtn.on('pointerout', () => this.backBtn.setStyle({ color: this.backFocused ? '#ffffff' : '#7799aa' }));
        this.backBtn.on('pointerdown', () => this.goBack());
        // Multiplayer: sync confirmations through server
        const nm = this.registry.get('networkManager') ?? null;
        if (nm && this.isMultiplayer) {
            nm.onRemoteCharConfirm = (pid, charIdx) => {
                if (pid < 0 || pid >= this.playerCount)
                    return;
                this.selections[pid] = charIdx;
                this.confirmed[pid] = true;
                this.confirmMarks[pid]?.setVisible(true);
                this.updateCursorPos(pid);
                this.updateStartText();
            };
            nm.onAllCharsConfirmed = (charIdxs) => {
                if (this.started)
                    return;
                this.started = true;
                const selectedChars = charIdxs.map(idx => this.chars[idx]?.key ?? this.chars[0].key);
                this.registry.set('selectedChars', selectedChars);
                this.cameras.main.fadeOut(400, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
            };
        }
        // Keyboard input
        const kb = this.input.keyboard;
        if (this.isMultiplayer) {
            // In multiplayer every key controls localPlayerId
            const lp = this.localPlayerId;
            kb.addKey('A').on('down', () => { if (!this.backFocused)
                this.move(lp, -1); });
            kb.addKey('D').on('down', () => { if (!this.backFocused)
                this.move(lp, 1); });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => { if (!this.backFocused)
                this.move(lp, -1); });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => { if (!this.backFocused)
                this.move(lp, 1); });
            kb.addKey('W').on('down', () => { if (this.backFocused)
                this.focusBack(false);
            else
                this.confirm(lp); });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down', () => { if (this.backFocused)
                this.focusBack(false);
            else
                this.confirm(lp); });
            kb.addKey('S').on('down', () => this.focusBack(true));
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => this.focusBack(true));
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => { if (this.backFocused)
                this.goBack();
            else
                this.confirm(lp); });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.goBack());
        }
        else {
            kb.addKey('A').on('down', () => { if (!this.backFocused)
                this.move(0, -1); });
            kb.addKey('D').on('down', () => { if (!this.backFocused)
                this.move(0, 1); });
            kb.addKey('W').on('down', () => {
                if (this.backFocused)
                    this.focusBack(false);
                else
                    this.confirm(0);
            });
            kb.addKey('S').on('down', () => this.focusBack(true));
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => this.focusBack(true));
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => {
                if (this.backFocused)
                    this.goBack();
                else
                    this.tryStart();
            });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.goBack());
            if (this.playerCount > 1) {
                kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => { if (!this.backFocused)
                    this.move(1, -1); });
                kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => { if (!this.backFocused)
                    this.move(1, 1); });
                kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down', () => {
                    if (this.backFocused)
                        this.focusBack(false);
                    else
                        this.confirm(1);
                });
            }
        }
        // Gamepad input
        this.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, (pad, button) => {
            const activePads = this.input.gamepad.gamepads.filter(Boolean);
            const padIdx = activePads.indexOf(pad);
            if (padIdx < 0)
                return;
            const p = this.isMultiplayer ? this.localPlayerId : Math.min(padIdx, this.playerCount - 1);
            if (button.index === 13) {
                this.focusBack(true);
                return;
            }
            if (button.index === 12) {
                if (this.backFocused)
                    this.focusBack(false);
                return;
            }
            if (button.index === 14) {
                if (!this.backFocused)
                    this.move(p, -1);
            }
            if (button.index === 15) {
                if (!this.backFocused)
                    this.move(p, 1);
            }
            if (button.index === 0) {
                if (this.backFocused)
                    this.goBack();
                else
                    this.confirm(p);
            }
            if (button.index === 1)
                this.goBack();
            if (button.index === 9)
                this.tryStart();
        });
    }
    buildCard(cx, cy, char) {
        this.add.rectangle(cx, cy, CARD_W, CARD_H, 0x111128).setStrokeStyle(1, 0x223355);
        if (this.textures.exists(char.sheetKey)) {
            this.add.image(cx, cy - 18, char.sheetKey, char.previewFrame).setScale(2.5).setDepth(2);
        }
        else {
            this.add.rectangle(cx, cy - 18, 64, 64, 0x334466).setDepth(2);
        }
        this.add.text(cx, cy + 75, char.name, {
            fontSize: '8px', fontFamily: FONT, color: '#aaccdd',
        }).setOrigin(0.5).setDepth(2);
    }
    move(player, dir) {
        if (this.confirmed[player])
            return;
        this.selections[player] = (this.selections[player] + dir + this.chars.length) % this.chars.length;
        this.updateCursorPos(player);
    }
    confirm(player) {
        if (this.confirmed[player]) {
            // In multiplayer, once confirmed you can't take it back (server already received it)
            if (!this.isMultiplayer) {
                this.confirmed[player] = false;
                this.confirmMarks[player].setVisible(false);
                this.updateStartText();
            }
            return;
        }
        this.confirmed[player] = true;
        this.confirmMarks[player].setVisible(true);
        this.updateCursorPos(player);
        this.updateStartText();
        if (this.isMultiplayer) {
            const nm = this.registry.get('networkManager') ?? null;
            nm?.sendCharConfirm(this.selections[this.localPlayerId]);
        }
        else {
            if (this.confirmed.every(Boolean))
                this.startScene();
        }
    }
    updateCursorPos(player) {
        const card = this.cards[this.selections[player]];
        if (!card)
            return;
        this.cursors[player].setPosition(card.x, card.y);
        this.playerLabels[player].setPosition(card.x, card.y - CARD_H / 2 - 4);
        this.confirmMarks[player].setPosition(card.x + CARD_W / 2 - 8, card.y - CARD_H / 2 + 8);
    }
    updateStartText() {
        if (this.isMultiplayer) {
            if (this.confirmed[this.localPlayerId]) {
                this.startText.setText('CONFIRMED! STARTING...').setColor('#ffe066');
            }
            else {
                this.startText.setText('TAP A CHARACTER TO CONFIRM').setColor('#556677');
            }
        }
        else {
            if (this.confirmed.every(Boolean)) {
                this.startText.setText('ALL READY!').setColor('#ffe066');
            }
            else if (this.confirmed.some(Boolean)) {
                this.startText.setText('WAITING FOR ALL PLAYERS...').setColor('#aaccdd');
            }
            else {
                this.startText.setText('TAP A CHARACTER TO CONFIRM').setColor('#556677');
            }
        }
    }
    tryStart() {
        if (this.started)
            return;
        if (this.isMultiplayer) {
            if (!this.confirmed[this.localPlayerId])
                this.confirm(this.localPlayerId);
            return;
        }
        if (this.playerCount === 1 && !this.confirmed[0]) {
            this.confirmed[0] = true;
            this.startScene();
            return;
        }
        if (this.confirmed.every(Boolean))
            this.startScene();
    }
    startScene() {
        if (this.started)
            return;
        this.started = true;
        const selectedChars = this.selections.map(idx => this.chars[idx].key);
        this.registry.set('selectedChars', selectedChars);
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
    }
    focusBack(on) {
        this.backFocused = on;
        this.backBtn.setStyle({ color: on ? '#ffffff' : '#7799aa' });
        if (on) {
            const b = this.backBtn.getBounds();
            this.backCursor.setPosition(b.left - 6, b.centerY);
        }
        this.backCursor.setVisible(on);
    }
    goBack() {
        if (this.started)
            return;
        const nm = this.registry.get('networkManager');
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(nm ? 'LobbyScene' : 'MenuScene'));
    }
}
