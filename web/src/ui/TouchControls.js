export class TouchControls {
    scene;
    dpadLeft = false;
    dpadRight = false;
    jumpHeld = false;
    inhaleHeld = false;
    abilityJust = false;
    meleeJust = false;
    _interactJust = false;
    _enabled = true;
    _allObjects = [];
    constructor(scene) {
        this.scene = scene;
        this.buildButtons();
    }
    get interactJust() {
        const v = this._interactJust;
        this._interactJust = false;
        return v;
    }
    setEnabled(v) {
        this._enabled = v;
        for (const o of this._allObjects)
            o.setVisible(v);
        if (!v) {
            this.dpadLeft = false;
            this.dpadRight = false;
            this.jumpHeld = false;
            this.inhaleHeld = false;
            this.abilityJust = false;
            this.meleeJust = false;
            this._interactJust = false;
        }
    }
    buildButtons() {
        const { width, height } = this.scene.scale;
        // D-pad (left side) — inverted-T layout
        const dpx = 110;
        const dpy = height - 65;
        this.dpadBtn(dpx - 58, dpy, '◄', 0x90caf9, () => { this.dpadLeft = true; }, () => { this.dpadLeft = false; });
        this.dpadBtn(dpx + 58, dpy, '►', 0x90caf9, () => { this.dpadRight = true; }, () => { this.dpadRight = false; });
        this.dpadBtn(dpx, dpy - 65, '▲', 0x90caf9, () => { this.jumpHeld = true; this._interactJust = true; }, () => { this.jumpHeld = false; });
        // Action buttons (right side)
        const bx = width - 55;
        const by = height - 65;
        this.btn(bx, by, '▲', 0x4fc3f7, () => { this.jumpHeld = true; }, () => { this.jumpHeld = false; });
        this.btn(bx, by - 70, 'X', 0xa5d6a7, () => { this.abilityJust = true; });
        this.btn(bx - 70, by - 70, 'Z', 0xce93d8, () => { this.inhaleHeld = true; }, () => { this.inhaleHeld = false; });
        this.btn(bx - 70, by, '⚔', 0xef9a9a, () => { this.meleeJust = true; });
    }
    dpadBtn(x, y, label, color, onDown, onUp) {
        const circle = this.scene.add.circle(x, y, 30, color, 0.55)
            .setScrollFactor(0).setDepth(50).setInteractive();
        const lbl = this.scene.add.text(x, y, label, { fontSize: '18px', color: '#000', fontStyle: 'bold' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this._allObjects.push(circle, lbl);
        circle.on('pointerdown', onDown);
        if (onUp) {
            circle.on('pointerup', onUp);
            circle.on('pointerout', onUp);
        }
    }
    btn(x, y, label, color, onDown, onUp) {
        const circle = this.scene.add.circle(x, y, 28, color, 0.7)
            .setScrollFactor(0).setDepth(50).setInteractive();
        const lbl = this.scene.add.text(x, y, label, { fontSize: '16px', color: '#000', fontStyle: 'bold' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this._allObjects.push(circle, lbl);
        circle.on('pointerdown', onDown);
        if (onUp) {
            circle.on('pointerup', onUp);
            circle.on('pointerout', onUp);
        }
    }
    apply(player) {
        if (!this._enabled || !player.isAlive || player.isInhaled)
            return;
        if (this.dpadLeft)
            player.moveLeft();
        else if (this.dpadRight)
            player.moveRight();
        else
            player.stopHorizontal();
        if (this.jumpHeld)
            player.jump();
        else
            player.jumpReleased();
        player.setShielding(this.inhaleHeld);
        if (this.abilityJust) {
            player.useCharacterAbility();
            this.abilityJust = false;
        }
        if (this.meleeJust) {
            player.swingMelee();
            this.meleeJust = false;
        }
    }
    destroy() {
        // objects are scene-managed; no manual teardown needed
    }
}
