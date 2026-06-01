import Phaser from 'phaser';
const MOVE_SPEED = 600;
const LIFETIME_MS = 10000;
const AGGRO_RANGE = 320;
export class ScarlettTRex extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'sheet-trex', 0);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(1.3).setDepth(3);
        const body = this.body;
        body.setSize(52, 54, false);
        body.setOffset(6, 8);
        body.setAllowGravity(true);
        scene.time.delayedCall(LIFETIME_MS, () => { if (this.active)
            this.die(); });
    }
    static get moveSpeed() { return MOVE_SPEED; }
    static get aggroRange() { return AGGRO_RANGE; }
    die() {
        this.emit('trexExpired', this);
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: 400,
            onComplete: () => { if (this.active)
                this.destroy(); },
        });
    }
}
