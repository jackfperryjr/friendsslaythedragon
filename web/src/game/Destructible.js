import Phaser from 'phaser';
import { AbilityType } from '../types';
const FRAGMENT_COUNT = 7;
export class Destructible extends Phaser.Physics.Arcade.Image {
    health;
    resistances;
    abilityDrop;
    constructor(scene, x, y, maxHealth = 100, abilityDrop = AbilityType.None, resistances = {}) {
        super(scene, x, y, 'destructible');
        this.health = maxHealth;
        this.abilityDrop = abilityDrop;
        this.resistances = resistances;
        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        // Tint by ability drop
        const tints = {
            [AbilityType.None]: 0x78909c,
            [AbilityType.Fire]: 0xff6600,
            [AbilityType.Lightning]: 0xffdd00,
            [AbilityType.Ice]: 0x66ccff,
            [AbilityType.Bat]: 0x78909c,
            [AbilityType.BlackDragon]: 0x78909c,
        };
        this.setTint(tints[abilityDrop]);
    }
    takeDamage(amount, type) {
        const resistance = this.resistances[type] ?? 0;
        this.health -= amount * (1 - resistance);
        this.emit('hit');
        this.setTint(0xff6666);
        this.scene.time.delayedCall(120, () => {
            const tints = {
                [AbilityType.None]: 0x78909c, [AbilityType.Fire]: 0xff6600,
                [AbilityType.Lightning]: 0xffdd00, [AbilityType.Ice]: 0x66ccff,
                [AbilityType.Bat]: 0x78909c, [AbilityType.BlackDragon]: 0x78909c,
            };
            if (this.active)
                this.setTint(tints[this.abilityDrop]);
        });
        if (this.health <= 0)
            this.shatter();
    }
    shatter() {
        this.spawnFragments();
        this.emit('destroyed', this);
        this.destroy();
    }
    spawnFragments() {
        for (let i = 0; i < FRAGMENT_COUNT; i++) {
            const frag = this.scene.physics.add.image(this.x + Phaser.Math.Between(-20, 20), this.y + Phaser.Math.Between(-20, 20), 'fragment');
            frag.body.setVelocity(Phaser.Math.Between(-220, 220), Phaser.Math.Between(-400, -120));
            this.scene.time.delayedCall(3500, () => { if (frag.active)
                frag.destroy(); });
        }
    }
}
