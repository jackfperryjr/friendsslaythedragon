import Phaser from 'phaser';
const DETECT_RANGE = 420; // px — trigger spin-dash when enemy is this close
const CHARGE_SPEED = 1750; // 5× player speed
const CHARGE_TIMEOUT = 2000; // ms — auto spin-down if charge goes this long without a hit
export class CocoShadow extends Phaser.Physics.Arcade.Sprite {
    shadowState = 'summoning';
    chargeTimer = null;
    constructor(scene, x, y) {
        super(scene, x, y, 'sheet-shadow', 6);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(1.3).setDepth(3);
        const body = this.body;
        body.setSize(42, 60, false);
        body.setOffset(18, 0);
        body.setAllowGravity(true);
        body.checkCollision.left = true;
        body.checkCollision.right = true;
        // Summon: play spin-up animation, then settle into idle follow mode
        this.play('shadow-spin-up');
        this.once('animationcomplete-shadow-spin-up', () => {
            if (this.active && this.shadowState === 'summoning')
                this.enterIdle();
        });
    }
    static get detectRange() { return DETECT_RANGE; }
    static get chargeSpeed() { return CHARGE_SPEED; }
    // ── state transitions ───────────────────────────────────────────────────────
    enterIdle() {
        this.shadowState = 'idle';
        this.body.setVelocityX(0);
        this.chargeTimer?.remove();
        this.chargeTimer = null;
    }
    beginSpinUp(target) {
        if (this.shadowState !== 'idle')
            return;
        this.shadowState = 'spinning-up';
        this.play('shadow-spin-up');
        this.once('animationcomplete-shadow-spin-up', () => {
            if (!this.active || this.shadowState !== 'spinning-up')
                return;
            this.shadowState = 'charging';
            this.play('shadow-charge', true);
            this.emit('startCharge', this, target);
            // Safety timeout — spin down if we never hit
            this.chargeTimer = this.scene.time.delayedCall(CHARGE_TIMEOUT, () => {
                if (this.active && this.shadowState === 'charging')
                    this.endCharge();
            });
        });
    }
    hitEnemy() {
        if (this.shadowState !== 'charging')
            return;
        this.endCharge();
    }
    release() {
        if (this.shadowState === 'releasing')
            return;
        this.chargeTimer?.remove();
        this.chargeTimer = null;
        this.shadowState = 'releasing';
        this.body.setVelocity(0, 0);
        this.play('shadow-spin-up');
        this.once('animationcomplete-shadow-spin-up', () => {
            if (!this.active)
                return;
            this.emit('shadowReleased', this);
            this.scene.tweens.add({
                targets: this, alpha: 0, duration: 200,
                onComplete: () => { if (this.active)
                    this.destroy(); },
            });
        });
    }
    endCharge() {
        this.chargeTimer?.remove();
        this.chargeTimer = null;
        this.shadowState = 'spinning-down';
        this.body.setVelocity(0, 0);
        this.play('shadow-spin-down');
        this.once('animationcomplete-shadow-spin-down', () => {
            if (this.active && this.shadowState === 'spinning-down')
                this.enterIdle();
        });
    }
}
