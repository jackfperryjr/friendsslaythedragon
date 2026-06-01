import Phaser from 'phaser';
const FONT = '"Press Start 2P", monospace';
const FADE_MS = 600;
const HOLD_MS = 1600;
const SLIDE_MS = FADE_MS + HOLD_MS + FADE_MS + 200;
export class IntroScene extends Phaser.Scene {
    skipped = false;
    constructor() { super({ key: 'IntroScene' }); }
    preload() {
        this.load.image('intro-jack', 'assets/app_icons/jack.png');
        this.load.image('intro-carter', 'assets/gifs/carter.gif');
        this.load.image('intro-callum', 'assets/gifs/callum.gif');
        this.load.image('intro-conrad', 'assets/gifs/conrad.gif');
        this.load.image('intro-splat', 'assets/app_icons/splat.png');
    }
    create() {
        this.cameras.main.setBackgroundColor('#000000');
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.skipped = false;
        this.input.once('pointerdown', () => this.skip());
        this.input.keyboard?.once('keydown', () => this.skip());
        this.input.gamepad?.once(Phaser.Input.Gamepad.Events.BUTTON_DOWN, () => this.skip());
        let t = 300;
        this.scheduleProducedBy(t);
        t += SLIDE_MS;
        this.scheduleInspiredBy(t);
        t += SLIDE_MS;
        this.scheduleDevelopedBy(t);
        t += SLIDE_MS;
        this.time.delayedCall(t + 100, () => { if (!this.skipped)
            this.toMenu(); });
    }
    skip() {
        if (this.skipped)
            return;
        this.skipped = true;
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.toMenu();
    }
    toMenu() {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    }
    // ── slide 1: produced by jack ────────────────────────────────────────────────
    scheduleProducedBy(startAt) {
        const { width, height } = this.scale;
        const cx = width / 2, cy = height / 2;
        const label = this.label(cx, cy - 90, 'PRODUCED BY');
        const jackImg = this.textures.exists('intro-jack')
            ? this.add.image(cx, cy + 4, 'intro-jack').setDisplaySize(110, 110).setAlpha(0)
            : null;
        const nameText = this.add.text(cx, cy + 92, 'JACK', {
            fontSize: '18px', fontFamily: FONT, color: '#4b4a4d',
            stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);
        const [lineL, lineR] = this.lines(cx, cy - 90);
        const objs = [label, nameText, ...(jackImg ? [jackImg] : [])];
        this.animSlide(startAt, objs, [lineL, lineR], nameText);
    }
    // ── slide 2: inspired by the boys ────────────────────────────────────────────
    scheduleInspiredBy(startAt) {
        const { width, height } = this.scale;
        const cx = width / 2, cy = height / 2;
        const label = this.label(cx, cy - 80, 'INSPIRED BY');
        const nameText = this.add.text(cx, cy + 120, 'THE BOYS', {
            fontSize: '22px', fontFamily: FONT, color: '#f23906',
            stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);
        const imgSize = 88;
        const spacing = 108;
        const imgsY = cy + 14;
        const kidObjs = [];
        for (const [key, x] of [
            ['intro-carter', cx - spacing],
            ['intro-callum', cx],
            ['intro-conrad', cx + spacing],
        ]) {
            if (this.textures.exists(key)) {
                kidObjs.push(this.add.image(x, imgsY, key).setDisplaySize(imgSize, imgSize).setAlpha(0));
            }
        }
        const [lineL, lineR] = this.lines(cx, cy - 80);
        const objs = [label, nameText, ...kidObjs];
        this.animSlide(startAt, objs, [lineL, lineR], nameText);
    }
    // ── slide 3: developed by claude ─────────────────────────────────────────────
    scheduleDevelopedBy(startAt) {
        const { width, height } = this.scale;
        const cx = width / 2, cy = height / 2;
        const label = this.label(cx, cy - 50, 'DEVELOPED BY');
        const name = this.add.text(0, cy + 16, 'CLAUDE', {
            fontSize: '46px', fontFamily: FONT, color: '#3b4447',
            stroke: '#000000', strokeThickness: 10,
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);
        const sub = this.add.text(cx, cy + 80, '( AN ANTHROPIC AI )', {
            fontSize: '9px', fontFamily: FONT, color: '#445566',
        }).setOrigin(0.5).setAlpha(0);
        const splatW = 52;
        const gap = 10;
        const textW = name.width;
        const groupW = splatW + gap + textW;
        const splatX = cx - groupW / 2 + splatW / 2;
        const textX = cx - groupW / 2 + splatW + gap + textW / 2;
        name.setX(textX);
        const useSplatImg = this.textures.exists('intro-splat');
        const splatL = useSplatImg
            ? this.add.image(splatX, cy + 16, 'intro-splat').setDisplaySize(splatW, splatW).setAlpha(0)
            : (() => { const g = this.makeSplat(splatX, cy + 16); g.setAlpha(0); return g; })();
        const [lineL, lineR] = this.lines(cx, cy - 50);
        const objs = [label, name, sub, splatL];
        this.animSlide(startAt, objs, [lineL, lineR], name);
    }
    // ── shared helpers ────────────────────────────────────────────────────────────
    label(x, y, text) {
        return this.add.text(x, y, text, {
            fontSize: '11px', fontFamily: FONT, color: '#556677', letterSpacing: 8,
        }).setOrigin(0.5).setAlpha(0);
    }
    lines(cx, y) {
        return [
            this.add.rectangle(cx - 220, y, 160, 1, 0x334455, 0).setOrigin(0.5),
            this.add.rectangle(cx + 220, y, 160, 1, 0x334455, 0).setOrigin(0.5),
        ];
    }
    animSlide(startAt, objs, lines, scaleTarget) {
        this.time.delayedCall(startAt, () => {
            if (this.skipped)
                return;
            this.tweens.add({ targets: objs, alpha: 1, duration: FADE_MS });
            this.tweens.add({ targets: lines, alpha: 0.6, duration: FADE_MS + 200 });
            this.tweens.add({ targets: scaleTarget, scaleX: 1, scaleY: 1, duration: FADE_MS + 80, ease: 'Back.Out' });
            this.time.delayedCall(FADE_MS + HOLD_MS, () => {
                if (this.skipped)
                    return;
                this.tweens.add({ targets: [...objs, ...lines], alpha: 0, duration: FADE_MS });
            });
        });
    }
    makeSplat(x, y) {
        const col = 0x80d8ff;
        const g = this.add.graphics();
        g.setPosition(x, y);
        g.lineStyle(2, col, 0.9);
        g.fillStyle(col, 1);
        const rays = 8;
        const outer = 22;
        const inner = 4;
        for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2;
            const midA = a + Math.PI / rays;
            g.beginPath();
            g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
            g.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
            g.lineTo(Math.cos(midA) * (outer * 0.45), Math.sin(midA) * (outer * 0.45));
            g.closePath();
            g.fillPath();
        }
        g.fillCircle(0, 0, inner + 1);
        return g;
    }
}
