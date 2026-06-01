import Phaser from 'phaser';
import { AbilityType } from '../types';
import { SoundManager } from '../audio/SoundManager';
const WALK_SPEED = 80;
const ATTACK_INTERVAL = {
    [AbilityType.None]: 0,
    [AbilityType.Fire]: 2800,
    [AbilityType.Lightning]: 3400,
    [AbilityType.Ice]: 3000,
    [AbilityType.Bat]: 0,
    [AbilityType.BlackDragon]: 2800,
};
const ENEMY_SHEET = {
    [AbilityType.None]: 'sheet-enemy-mom',
    [AbilityType.Fire]: 'sheet-enemy-zombie',
    [AbilityType.Lightning]: 'sheet-enemy-skeleton',
    [AbilityType.Ice]: 'sheet-enemy-duck',
    [AbilityType.Bat]: 'sheet-enemy-bat',
    [AbilityType.BlackDragon]: 'sheet-black-dragon',
};
const ENEMY_BODY = {
    [AbilityType.None]: [44, 50],
    [AbilityType.Fire]: [38, 50],
    [AbilityType.Lightning]: [38, 50],
    [AbilityType.Ice]: [40, 34],
    [AbilityType.Bat]: [36, 28],
    [AbilityType.BlackDragon]: [38, 40],
};
export class Enemy extends Phaser.Physics.Arcade.Sprite {
    abilityType;
    flying;
    walkDir = 1;
    beingPulled = false;
    animKey;
    attackTimer;
    stunTimer = 0;
    hp = 5;
    constructor(scene, x, y, ability) {
        const isFlying = ability === AbilityType.Ice || ability === AbilityType.Bat || ability === AbilityType.BlackDragon;
        const sheetKey = ENEMY_SHEET[ability];
        super(scene, x, y, sheetKey);
        this.abilityType = ability;
        this.flying = isFlying;
        this.animKey = sheetKey;
        this.attackTimer = ATTACK_INTERVAL[ability] * (0.4 + Math.random() * 0.6);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        if (ability !== AbilityType.None)
            this.setScale(1.55); // 64px frame → ~99px display
        const [bw, bh] = ENEMY_BODY[ability];
        const body = this.body;
        body.setCollideWorldBounds(true);
        body.setSize(bw, bh, false);
        body.setOffset((this.displayWidth - bw) / 2, Math.round(this.displayHeight * 0.11));
        if (isFlying)
            body.setAllowGravity(false);
        this.play(`${this.animKey}-walk`);
    }
    update() {
        if (this.beingPulled)
            return;
        if (this.stunTimer > 0) {
            this.stunTimer -= this.scene.game.loop.delta;
            return;
        }
        const body = this.body;
        if (this.flying) {
            if (body.blocked.left)
                this.walkDir = 1;
            if (body.blocked.right)
                this.walkDir = -1;
            body.setVelocityX(WALK_SPEED * this.walkDir);
            body.setVelocityY(Math.sin(this.scene.time.now / 600) * 40);
            this.setFlipX(this.walkDir > 0);
            return;
        }
        if (body.blocked.left)
            this.walkDir = 1;
        if (body.blocked.right)
            this.walkDir = -1;
        body.setVelocityX(WALK_SPEED * this.walkDir);
        this.setFlipX(this.walkDir > 0);
    }
    /** Returns true once per attack cycle; GameScene handles the actual projectile. */
    tryAttack(dt) {
        const interval = ATTACK_INTERVAL[this.abilityType];
        if (interval === 0)
            return false;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = interval * (0.7 + Math.random() * 0.6);
            return true;
        }
        return false;
    }
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
    stun(ms) {
        this.stunTimer = ms;
    }
    hit() {
        if (this.hp <= 0)
            return;
        this.hp--;
        if (this.hp <= 0) {
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
            alpha: 0, scaleX: 1.8, scaleY: 1.8,
            duration: 280,
            onComplete: () => this.destroy(),
        });
    }
}
