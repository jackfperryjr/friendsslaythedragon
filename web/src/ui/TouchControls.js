export class TouchControls {
    scene;
    dpadLeft = false;
    dpadRight = false;
    jumpHeld = false;
    shieldHeld = false;
    shieldJust = false;
    abilityJust = false;
    meleeJust = false;
    _interactJust = false;
    _enabled = true;
    _allObjects = [];
    joystickBase;
    joystickKnob;
    joystickActive = false;
    joystickPointer = null;
    joystickBaseX = 0;
    joystickBaseY = 0;
    JOYSTICK_RADIUS = 70;
    KNOB_RADIUS = 26;
    DEAD_ZONE = 15;
    H_DEAD_ZONE = 24;
    // Buttons are anchored bottom-right; offsets are relative to (width, height)
    // so they can be recomputed when the visible viewport changes (mobile browser
    // chrome showing/hiding resizes the canvas after these controls are built).
    buttonOffsets = [];
    onResize = (gameSize) => this.reposition(gameSize.width, gameSize.height);
    constructor(scene) {
        this.scene = scene;
        this.buildButtons();
        this.scene.scale.on('resize', this.onResize);
        this.scene.events.once('shutdown', () => this.destroy());
    }
    reposition(width, height) {
        this.joystickBaseX = 110;
        this.joystickBaseY = height - 110;
        this.joystickBase.setPosition(this.joystickBaseX, this.joystickBaseY);
        if (!this.joystickActive)
            this.joystickKnob.setPosition(this.joystickBaseX, this.joystickBaseY);
        const bx = width - 65;
        const by = height - 80;
        for (const b of this.buttonOffsets) {
            b.circle.setPosition(bx + b.dx, by + b.dy);
            b.label.setPosition(bx + b.dx, by + b.dy);
        }
    }
    get interactJust() {
        const v = this._interactJust;
        this._interactJust = false;
        return v;
    }
    consumeShieldJust() {
        const v = this.shieldJust;
        this.shieldJust = false;
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
            this.shieldHeld = false;
            this.shieldJust = false;
            this.abilityJust = false;
            this.meleeJust = false;
            this._interactJust = false;
            this.joystickActive = false;
            this.joystickPointer = null;
            this.joystickKnob?.setPosition(this.joystickBaseX, this.joystickBaseY);
        }
    }
    buildButtons() {
        const { width, height } = this.scene.scale;
        this.buildJoystick(height);
        // Action buttons (right side), offsets relative to the bottom-right anchor (bx, by)
        const bx = width - 65;
        const by = height - 80;
        this.btn(bx, by, 0, 0, '▲', 0x4fc3f7, () => { this._interactJust = true; });
        this.btn(bx, by, 0, -84, 'X', 0xa5d6a7, () => { this.abilityJust = true; });
        this.btn(bx, by, -84, -84, 'Z', 0xce93d8, () => { this.shieldHeld = true; this.shieldJust = true; }, () => { this.shieldHeld = false; });
        this.btn(bx, by, -84, 0, '⚔', 0xef9a9a, () => { this.meleeJust = true; });
    }
    buildJoystick(height) {
        this.joystickBaseX = 110;
        this.joystickBaseY = height - 110;
        this.joystickBase = this.scene.add.circle(this.joystickBaseX, this.joystickBaseY, this.JOYSTICK_RADIUS, 0x90caf9, 0.25).setScrollFactor(0).setDepth(50).setInteractive();
        this.joystickKnob = this.scene.add.circle(this.joystickBaseX, this.joystickBaseY, this.KNOB_RADIUS, 0x90caf9, 0.7).setScrollFactor(0).setDepth(51);
        this._allObjects.push(this.joystickBase, this.joystickKnob);
        this.joystickBase.on('pointerdown', (ptr) => {
            this.joystickActive = true;
            this.joystickPointer = ptr;
            this.updateJoystick(ptr.x, ptr.y);
        });
        this.scene.input.on('pointermove', (ptr) => {
            if (this.joystickActive && ptr === this.joystickPointer) {
                this.updateJoystick(ptr.x, ptr.y);
            }
        });
        this.scene.input.on('pointerup', (ptr) => {
            if (this.joystickActive && ptr === this.joystickPointer) {
                this.resetJoystick();
            }
        });
    }
    updateJoystick(px, py) {
        const dx = px - this.joystickBaseX;
        const dy = py - this.joystickBaseY;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            const clamp = Math.min(mag, this.JOYSTICK_RADIUS);
            const angle = Math.atan2(dy, dx);
            this.joystickKnob.setPosition(this.joystickBaseX + Math.cos(angle) * clamp, this.joystickBaseY + Math.sin(angle) * clamp);
        }
        // Per-axis dead zones: larger horizontal dead zone reduces left/right drift during jumps
        this.dpadLeft = dx < -this.H_DEAD_ZONE;
        this.dpadRight = dx > this.H_DEAD_ZONE;
        this.jumpHeld = dy < -this.DEAD_ZONE;
    }
    resetJoystick() {
        this.joystickActive = false;
        this.joystickPointer = null;
        this.dpadLeft = false;
        this.dpadRight = false;
        this.jumpHeld = false;
        this.joystickKnob.setPosition(this.joystickBaseX, this.joystickBaseY);
    }
    btn(bx, by, dx, dy, label, color, onDown, onUp) {
        const x = bx + dx;
        const y = by + dy;
        const circle = this.scene.add.circle(x, y, 36, color, 0.7)
            .setScrollFactor(0).setDepth(50).setInteractive();
        const lbl = this.scene.add.text(x, y, label, { fontSize: '20px', color: '#000', fontStyle: 'bold' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this._allObjects.push(circle, lbl);
        this.buttonOffsets.push({ circle, label: lbl, dx, dy });
        circle.on('pointerdown', onDown);
        if (onUp) {
            circle.on('pointerup', onUp);
            circle.on('pointerout', onUp);
        }
    }
    apply(player) {
        if (!this._enabled || !player.isAlive)
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
        if (!(player.charKey === 'conrad' && player.isConradTransformed))
            player.setShielding(this.shieldHeld);
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
        this.scene.scale.off('resize', this.onResize);
    }
}
