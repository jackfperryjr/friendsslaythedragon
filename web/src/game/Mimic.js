import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
const WALK_SPEED = 80;
export class Mimic extends Phaser.Physics.Arcade.Sprite {
    isAwake = false;
    _hp = 3;
    walkDir = 1;
    stunTimer = 0;
    beingPulled = false;
    constructor(scene, x, y) {
        super(scene, x, y, 'mimic', 0);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        if (!scene.anims.exists('mimic-walk')) {
            scene.anims.create({
                key: 'mimic-walk',
                frames: scene.anims.generateFrameNumbers('mimic', { start: 5, end: 13 }),
                frameRate: 10,
                repeat: -1,
            });
        }
        this.setDisplaySize(72, 72).setDepth(2);
        const body = this.body;
        body.setCollideWorldBounds(true);
        body.setSize(44, 44);
        body.setOffset(10, 3);
    }
    wake() {
        if (this.isAwake)
            return;
        this.isAwake = true;
        this.body.setVelocityX(WALK_SPEED * this.walkDir);
        this.play('mimic-walk');
    }
    hit() {
        if (this._hp <= 0)
            return;
        this._hp--;
        if (this._hp <= 0) {
            this.die();
            return;
        }
        this.setTint(0xffffff);
        this.scene.time.delayedCall(120, () => { if (this.active)
            this.clearTint(); });
    }
    die() {
        SoundManager.enemyDeath();
        this.body.setEnable(false);
        this.scene.tweens.add({
            targets: this,
            alpha: 0, scaleX: this.scaleX * 1.8, scaleY: this.scaleY * 1.8,
            duration: 280,
            onComplete: () => this.destroy(),
        });
    }
    stun(ms) {
        this.stunTimer = ms;
    }
    // Called by GameScene when the player inhales this mimic
    pullToward(tx, ty, speed) {
        this.beingPulled = true;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
        this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
    stopPull() {
        this.beingPulled = false;
    }
    swallow() {
        ;
        this.body.setEnable(false);
        this.scene.tweens.add({
            targets: this,
            scaleX: 0, scaleY: 0, alpha: 0,
            duration: 150,
            onComplete: () => this.destroy(),
        });
    }
    // Mimics never fire projectiles
    tryAttack(_dt) { return false; }
    update() {
        if (!this.isAwake || !this.active)
            return;
        if (this.beingPulled)
            return;
        if (this.stunTimer > 0) {
            this.stunTimer -= this.scene.game.loop.delta;
            return;
        }
        const body = this.body;
        if (body.blocked.left)
            this.walkDir = 1;
        if (body.blocked.right)
            this.walkDir = -1;
        body.setVelocityX(WALK_SPEED * this.walkDir);
        this.setFlipX(this.walkDir > 0);
    }
}
