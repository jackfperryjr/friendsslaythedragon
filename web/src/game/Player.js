import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { SoundManager } from '../audio/SoundManager';
const MOVE_SPEED = 350;
const JUMP_VELOCITY = -520;
const FLOAT_GRAVITY = -700;
export class Player extends Phaser.Physics.Arcade.Sprite {
    playerId;
    charKey;
    hearts = 5;
    isAlive = true;
    isInhaled = false; // still used when another player spits this one
    speedMultiplier = 1.0;
    controlsReversed = false;
    speedBoostActive = false;
    strengthBoostActive = false;
    invulnerabilityActive = false;
    isTruck = false;
    isTrex = false;
    isTransforming = false; // true during transform/untransform animation
    hitCount = 0;
    isFloating = false;
    isShielding = false;
    invincible = false;
    isMeleeing = false;
    animPrefix = null;
    rainbowTimer = null;
    constructor(scene, x, y, id) {
        const selectedChars = scene.registry.get('selectedChars');
        const charKey = selectedChars?.[id];
        let resolvedSheet = null;
        let resolvedPrefix = null;
        if (charKey && scene.textures.exists(`sheet-${charKey}`)) {
            resolvedSheet = `sheet-${charKey}`;
            resolvedPrefix = `char-${charKey}`;
        }
        else {
            const defaultSheet = BootScene.getSheetKey(id);
            if (defaultSheet && scene.textures.exists(defaultSheet)) {
                resolvedSheet = defaultSheet;
                resolvedPrefix = BootScene.getAnimPrefix(id);
            }
        }
        const textureKey = resolvedSheet ?? BootScene.getFallbackTexture(id);
        super(scene, x, y, textureKey);
        this.playerId = id;
        this.charKey = charKey ?? '';
        this.animPrefix = resolvedPrefix;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(1.3);
        const body = this.body;
        body.setCollideWorldBounds(false);
        body.setSize(42, 60, false);
        body.setOffset(18, 0);
    }
    // ── movement ────────────────────────────────────────────────────────────────
    moveLeft() {
        const dir = this.controlsReversed ? 1 : -1;
        this.body.setVelocityX(dir * MOVE_SPEED * this.speedMultiplier);
        this.setFlipX(this.controlsReversed ? false : true);
    }
    moveRight() {
        const dir = this.controlsReversed ? -1 : 1;
        this.body.setVelocityX(dir * MOVE_SPEED * this.speedMultiplier);
        this.setFlipX(this.controlsReversed ? true : false);
    }
    stopHorizontal() { ; this.body.setVelocityX(0); }
    jump() {
        const body = this.body;
        if (body.blocked.down) {
            body.setVelocityY(JUMP_VELOCITY * this.speedMultiplier);
            this.isFloating = false;
        }
        else if (!this.isFloating) {
            this.isFloating = true;
        }
    }
    jumpReleased() { this.isFloating = false; }
    applySpeedBoost(permanent) {
        this.speedMultiplier = 3.0;
        this.speedBoostActive = true;
        if (!permanent) {
            this.scene.time.delayedCall(30000, () => {
                if (this.active) {
                    this.speedMultiplier = 1.0;
                    this.speedBoostActive = false;
                }
            });
        }
    }
    applyStrengthBoost(permanent) {
        this.strengthBoostActive = true;
        if (!permanent) {
            this.scene.time.delayedCall(30000, () => {
                if (this.active)
                    this.strengthBoostActive = false;
            });
        }
    }
    applyInvulnerability(permanent) {
        this.invulnerabilityActive = true;
        this.rainbowTimer?.remove();
        let hueIdx = 0;
        const rainbow = [0xff6666, 0xff9955, 0xffff55, 0x55ff88, 0x55aaff, 0xcc55ff];
        this.rainbowTimer = this.scene.time.addEvent({
            delay: 80, loop: true,
            callback: () => {
                if (!this.active) {
                    this.rainbowTimer?.remove();
                    this.rainbowTimer = null;
                    return;
                }
                this.setTint(rainbow[hueIdx % rainbow.length]);
                hueIdx++;
            },
        });
        if (!permanent) {
            this.scene.time.delayedCall(30000, () => {
                if (this.active) {
                    this.invulnerabilityActive = false;
                    this.rainbowTimer?.remove();
                    this.rainbowTimer = null;
                    this.clearTint();
                    this.setAlpha(1);
                }
            });
        }
    }
    applyTempEffect(type, ms) {
        if (type === 'fast') {
            this.speedMultiplier = 1.7;
            this.scene.time.delayedCall(ms, () => { if (this.active)
                this.speedMultiplier = 1.0; });
        }
        else {
            this.controlsReversed = true;
            this.setTint(0xcc00ff);
            this.scene.time.delayedCall(ms, () => {
                if (this.active) {
                    this.controlsReversed = false;
                    this.clearTint();
                }
            });
        }
    }
    update() {
        if (!this.isAlive || this.isInhaled)
            return;
        const body = this.body;
        body.setGravityY(this.isFloating ? FLOAT_GRAVITY * this.speedMultiplier : 0);
        if (body.blocked.down)
            this.isFloating = false;
        this.updateAnimation();
    }
    updateAnimation() {
        if (!this.animPrefix)
            return;
        if (this.isTruck || this.isTrex || this.isTransforming)
            return; // managed externally
        const body = this.body;
        const vx = Math.abs(body.velocity.x);
        let anim;
        if (this.isMeleeing)
            anim = 'melee';
        else if (this.isShielding)
            anim = 'inhale'; // reuse inhale art for shield pose
        else if (this.isFloating)
            anim = 'float';
        else if (!body.blocked.down && body.velocity.y > 80)
            anim = 'fall';
        else if (!body.blocked.down)
            anim = 'jump';
        else if (vx > 10)
            anim = 'walk';
        else
            anim = 'idle';
        const key = `${this.animPrefix}-${anim}`;
        if (this.anims.currentAnim?.key !== key)
            this.play(key, true);
    }
    // ── shield ─────────────────────────────────────────────────────────────────
    get shielding() { return this.isShielding; }
    setShielding(active) { this.isShielding = active; }
    // ── actions ─────────────────────────────────────────────────────────────────
    swingMelee() {
        if (this.isMeleeing || !this.isAlive || this.isInhaled)
            return;
        this.isMeleeing = true;
        this.emit('useMelee', this);
        this.scene.time.delayedCall(350, () => { if (this.active)
            this.isMeleeing = false; });
    }
    useCharacterAbility() {
        if (!this.isAlive || this.isInhaled)
            return;
        this.emit('useCharacterAbility', this);
    }
    // ── damage ──────────────────────────────────────────────────────────────────
    hitByEnemy() {
        if (this.invincible || this.invulnerabilityActive || this.isShielding || this.isTruck || !this.isAlive)
            return;
        SoundManager.playerHit();
        this.hitCount++;
        if (this.hitCount >= 5) {
            this.hitCount = 0;
            this.hearts--;
            this.emit('heartLost', this.hearts);
        }
        this.invincible = true;
        this.scene.tweens.add({
            targets: this, alpha: 0.2,
            duration: 120, yoyo: true, repeat: 5,
            onComplete: () => { this.setAlpha(1); this.invincible = false; },
        });
        const dx = this.body.velocity.x > 0 ? -1 : 1;
        this.body.setVelocityX(dx * 250);
        if (this.hearts <= 0)
            this.die();
    }
    takeDamage(_amount, _type) { this.hitByEnemy(); }
    destroy(fromScene) {
        super.destroy(fromScene);
    }
    stun(ms) {
        ;
        this.body.setVelocity(0, 0);
        this.setTint(0xffff00);
        this.scene.time.delayedCall(ms, () => this.clearTint());
    }
    die() {
        this.rainbowTimer?.remove();
        this.rainbowTimer = null;
        SoundManager.playerDeath();
        this.isAlive = false;
        this.setAlpha(0.3);
        this.setTint(0x888888);
        this.body.setEnable(false);
        this.emit('died', this);
    }
}
