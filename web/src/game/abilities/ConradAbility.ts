import Phaser from 'phaser'
import { Enemy } from '../Enemy'
import { Destructible } from '../Destructible'
import { ConradArmyTruck } from '../ConradArmyTruck'
import { ConradWhiteVehicle, WhiteVehicleType } from '../ConradWhiteVehicle'
import { DamageType } from '../../types'
import type { Player } from '../Player'
import type { GameScene } from '../../scenes/GameScene'
import type { CharacterAbility } from './CharacterAbility'

/** Conrad: transforms into a flying jet (melee fires lasers, shield summons vehicles), or deploys an army truck. */
export class ConradAbility implements CharacterAbility {
  private conradTrucks: ConradArmyTruck[] = []
  private conradWhiteVehicles: ConradWhiteVehicle[] = []

  constructor(private g: GameScene, private p: Player) {}

  use() {
    const p = this.p
    if (p.conradAbility === 'transform') {
      if (p.isConradTransformed) this.untransformConrad(p)
      else this.transformConrad(p)
    } else {
      this.spawnConradTruck(p)
    }
  }

  melee(): boolean {
    if (!this.p.isConradTransformed) return false
    this.fireConradJetLaser(this.p)
    return true
  }

  /** In jet form the shield button summons a vehicle instead of shielding. */
  replacesShield(): boolean {
    return this.p.isConradTransformed
  }

  shieldPressed() {
    this.spawnConradWhiteVehicle(this.p)
  }

  update() {
    this.updateConradTrucks()
    this.updateConradWhiteVehicles()
    this.updateConradTransformAnim()
  }

  // ── internals ────────────────────────────────────────────────────────────

  private spawnConradTruck(src: Player) {
    src.swingMelee()
    if (!this.g.textures.exists('sheet-army-truck')) return
    const truck = new ConradArmyTruck(this.g, src.x, src.y)
    truck.setFlipX(src.flipX)
    truck.setData('patrolDir', src.flipX ? -1 : 1)
    this.conradTrucks.push(truck)
    this.g.physics.add.collider(truck, this.g.platforms)
    this.g.tilemapLayers.forEach(l => this.g.physics.add.collider(truck, l))
    truck.on('fireShot',    (t: ConradArmyTruck) => this.fireConradTruckShot(t))
    truck.on('truckExpired', (t: ConradArmyTruck) => {
      this.conradTrucks = this.conradTrucks.filter(x => x !== t)
    })
  }

  private updateConradTrucks() {
    const RANGE = ConradArmyTruck.attackRange
    const SPEED = ConradArmyTruck.moveSpeed

    for (const truck of this.conradTrucks) {
      if (!truck.active) continue
      const body = truck.body as Phaser.Physics.Arcade.Body

      const nearTarget = this.g.nearestTarget(truck.x, truck.y, RANGE)

      const now      = this.g.time.now
      const holdUntil: number = truck.getData('shootHold') ?? 0

      if (nearTarget) {
        // Enemy in range — stop, face them, shoot; lock in shoot state briefly to dampen oscillation
        body.setVelocityX(0)
        const wasAlreadyShooting = truck.isShooting
        truck.isShooting = true
        truck.setData('shootHold', now + 800)
        truck.setFlipX(nearTarget.x < truck.x)
        // Fire immediately the moment the truck stops rather than waiting for the timer
        if (!wasAlreadyShooting) this.g.time.delayedCall(180, () => { if (truck.active && truck.isShooting) this.fireConradTruckShot(truck) })
      } else if (truck.isShooting && now < holdUntil) {
        // Still within the shoot-hold window — stay put
        body.setVelocityX(0)
      } else {
        // No nearby enemy — patrol back and forth
        truck.isShooting = false
        let dir: number = truck.getData('patrolDir') ?? 1

        // Reverse when hitting a wall in the current travel direction
        if ((dir > 0 && body.blocked.right) || (dir < 0 && body.blocked.left)) {
          dir = -dir
          truck.setData('patrolDir', dir)
        }
        body.setVelocityX(dir * SPEED)
        truck.setFlipX(dir < 0)
      }

      // Animation
      const moving = Math.abs(body.velocity.x) > 10
      const animKey = moving ? 'army-truck-move' : 'army-truck-idle'
      if (truck.anims.currentAnim?.key !== animKey) truck.play(animKey, true)
    }
  }

  private fireConradTruckShot(truck: ConradArmyTruck) {
    if (!truck.active) return
    this.fireVehicleShot(truck, this.g.nearestTarget(truck.x, truck.y, ConradArmyTruck.attackRange))
  }

  /** Shared by Conrad's army truck and white vehicles: fires a random-effect shell at the target. */
  private fireVehicleShot(vehicle: Phaser.GameObjects.Sprite, target: Enemy | Destructible | null) {
    type TruckEffect = 'fire' | 'ice' | 'explode' | 'blackhole' | 'lightning'
    const effectType = Phaser.Math.RND.pick(['fire', 'ice', 'explode', 'blackhole', 'lightning'] as TruckEffect[])
    const frame = effectType === 'fire' ? 1 : effectType === 'ice' ? 2 : effectType === 'explode' ? 3 : effectType === 'blackhole' ? 7 : 9
    // If no target in range, fire horizontally in the direction the truck faces
    const angle = target
      ? Phaser.Math.Angle.Between(vehicle.x, vehicle.y - 10, target.x, target.y)
      : (vehicle.flipX ? Math.PI : 0)
    const proj = this.g.physics.add.image(vehicle.x, vehicle.y - 10, 'sheet-truck-projectiles', frame)
    proj.setScale(1.8).setRotation(angle)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * 680, Math.sin(angle) * 680)
      .setGravityY(-800)

    const onHit = (hx: number, hy: number) => {
      if (!proj.active) return
      this.triggerTruckBulletEffect(effectType, hx, hy)
      proj.destroy()
    }

    this.g.enemies.forEach(e => {
      this.g.physics.add.overlap(proj, e, () => {
        if (!proj.active) return
        this.g.hitEnemy(e, this.g.player); onHit(e.x, e.y)
      })
    })
    for (const b of [this.g.boss, this.g.boss2]) {
      if (!b?.active) continue
      this.g.physics.add.overlap(proj, b, () => {
        if (!proj.active) return
        this.g.damageBoss(b); onHit(b.x, b.y)
      })
    }
    // Delay surface colliders so the bullet escapes the vehicle's spawn tile first
    this.g.time.delayedCall(150, () => {
      if (!proj.active) return
      this.g.physics.add.collider(proj, this.g.platforms, () => onHit(proj.x, proj.y))
      this.g.tilemapLayers.forEach(l => this.g.physics.add.collider(proj, l, () => onHit(proj.x, proj.y)))
    })
    this.g.time.delayedCall(2200, () => { if (proj.active) onHit(proj.x, proj.y) })
  }

  private transformConrad(player: Player) {
    if (player.isConradTransformed || player.isTransforming) return
    player.isTransforming = true
    player.setTexture('sheet-conrad-transform', 0)
    player.play('conrad-transform-in', true)
    player.once('animationcomplete-conrad-transform-in', () => {
      if (!player.active) return
      player.isConradTransformed = true
      player.isTransforming      = false
      player.speedMultiplier     = 2.0
      player.setScale(1.8)
      const fb = player.body as Phaser.Physics.Arcade.Body
      fb.setOffset(18, 10)
      fb.setAllowGravity(false)
      player.play('conrad-form-idle', true)
    })
  }

  private untransformConrad(player: Player) {
    if (!player.isConradTransformed || player.isTransforming) return
    player.isConradTransformed = false
    player.isFlyingDown        = false
    player.speedMultiplier     = 1.0
    player.setScale(1.3)
    const ub = player.body as Phaser.Physics.Arcade.Body
    ub.setOffset(18, 0)
    ub.setAllowGravity(true)
    ub.setVelocityY(0)
    player.isTransforming      = true
    player.setTexture('sheet-conrad-transform', 6)
    player.play('conrad-transform-out', true)
    player.once('animationcomplete-conrad-transform-out', () => {
      if (!player.active) return
      player.isTransforming = false
      player.setTexture(`sheet-${player.charKey}`, 0)
      player.play(`char-${player.charKey}-idle`, true)
    })
  }

  private updateConradTransformAnim() {
    const p = this.g.player
    if (p.charKey !== 'conrad' || !p.isAlive || !p.isConradTransformed || p.isTransforming) return
    const body = p.body as Phaser.Physics.Arcade.Body
    const vy   = Math.abs(body.velocity.y)
    const vx   = Math.abs(body.velocity.x)
    const key  = vy > 10 ? 'conrad-form-air' : vx > 10 ? 'conrad-form-walk' : 'conrad-form-idle'
    if (p.anims.currentAnim?.key !== key) {
      p.setTexture('sheet-conrad-transform')
      p.play(key, true)
    }

    // Break furniture and chests on contact
    const now = this.g.time.now
    for (const d of this.g.destructibles) {
      if (!d.active) continue
      if (Phaser.Math.Distance.Between(p.x, p.y, d.x, d.y) > 60) continue
      const lastHit: number = d.getData('conradJetHit') ?? 0
      if (now - lastHit < 350) continue
      d.setData('conradJetHit', now)
      d.takeDamage(30, DamageType.Physical)
    }
  }

  private fireConradJetLaser(src: Player) {
    const RANGE = 700
    const target = this.g.nearestTarget(src.x, src.y, RANGE, true)

    const dir = src.flipX ? -1 : 1
    const muzzleX = src.x + dir * 32
    const muzzleY = src.y - 5
    const tx = target ? target.x : muzzleX + dir * RANGE
    const ty = target ? (target.y - 10) : muzzleY

    const gfx = this.g.add.graphics().setDepth(15)
    gfx.lineStyle(4, 0xff0022, 0.95)
    gfx.lineBetween(muzzleX, muzzleY, tx, ty)
    gfx.lineStyle(9, 0xff4444, 0.25)
    gfx.lineBetween(muzzleX, muzzleY, tx, ty)
    this.g.tweens.add({ targets: gfx, alpha: 0, duration: 200, onComplete: () => gfx.destroy() })

    const flash = this.g.add.circle(tx, ty, 10, 0xff0022, 1).setDepth(16)
    this.g.tweens.add({ targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5, duration: 180, ease: 'Power2', onComplete: () => flash.destroy() })
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const speed = 40 + Math.random() * 60
      const spark = this.g.add.rectangle(tx, ty, 4, 4, 0xff2200, 1).setDepth(16)
      this.g.tweens.add({
        targets: spark,
        x: tx + Math.cos(angle) * speed,
        y: ty + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 200 + Math.random() * 100,
        ease: 'Quad.Out',
        onComplete: () => spark.destroy(),
      })
    }

    if (target) this.g.hitTarget(target, src, 2)
  }

  private spawnConradWhiteVehicle(src: Player) {
    const types: WhiteVehicleType[] = ['truck', 'tank', 'helicopter']
    const vehicleType = Phaser.Math.RND.pick(types)
    const sheetKey = vehicleType === 'helicopter' ? 'sheet-white-heli' : vehicleType === 'tank' ? 'sheet-white-tank' : 'sheet-white-truck'
    if (!this.g.textures.exists(sheetKey)) return
    const spawnY = vehicleType === 'helicopter' ? src.y - 90 : src.y
    const vehicle = new ConradWhiteVehicle(this.g, src.x, spawnY, vehicleType)
    vehicle.setFlipX(src.flipX)
    vehicle.setData('patrolDir', src.flipX ? -1 : 1)
    this.conradWhiteVehicles.push(vehicle)
    if (vehicleType !== 'helicopter') {
      this.g.physics.add.collider(vehicle, this.g.platforms)
      this.g.tilemapLayers.forEach(l => this.g.physics.add.collider(vehicle, l))
    }
    vehicle.on('fireShot',    (v: ConradWhiteVehicle) => this.fireConradWhiteVehicleShot(v))
    vehicle.on('vehicleExpired', (v: ConradWhiteVehicle) => {
      this.conradWhiteVehicles = this.conradWhiteVehicles.filter(x => x !== v)
    })
  }

  private updateConradWhiteVehicles() {
    const RANGE = ConradWhiteVehicle.attackRange
    const SPEED = ConradWhiteVehicle.moveSpeed

    for (const vehicle of this.conradWhiteVehicles) {
      if (!vehicle.active) continue
      const body = vehicle.body as Phaser.Physics.Arcade.Body

      const nearTarget = this.g.nearestTarget(vehicle.x, vehicle.y, RANGE)

      const now = this.g.time.now
      const holdUntil: number = vehicle.getData('shootHold') ?? 0

      if (nearTarget) {
        body.setVelocityX(0)
        const wasAlreadyShooting = vehicle.isShooting
        vehicle.isShooting = true
        vehicle.setData('shootHold', now + 800)
        vehicle.setFlipX(nearTarget.x < vehicle.x)
        if (!wasAlreadyShooting) this.g.time.delayedCall(180, () => { if (vehicle.active && vehicle.isShooting) this.fireConradWhiteVehicleShot(vehicle) })
      } else if (vehicle.isShooting && now < holdUntil) {
        body.setVelocityX(0)
      } else {
        vehicle.isShooting = false
        let dir: number = vehicle.getData('patrolDir') ?? 1
        if ((dir > 0 && body.blocked.right) || (dir < 0 && body.blocked.left)) {
          dir = -dir
          vehicle.setData('patrolDir', dir)
        }
        body.setVelocityX(dir * SPEED)
        vehicle.setFlipX(dir < 0)
      }

      const animPrefix = vehicle.vehicleType === 'helicopter' ? 'heli' : vehicle.vehicleType
      const moving     = Math.abs(body.velocity.x) > 10
      const animKey    = moving ? `white-${animPrefix}-move` : `white-${animPrefix}-idle`
      if (vehicle.anims.currentAnim?.key !== animKey) vehicle.play(animKey, true)
    }
  }

  private fireConradWhiteVehicleShot(vehicle: ConradWhiteVehicle) {
    if (!vehicle.active) return
    this.fireVehicleShot(vehicle, this.g.nearestTarget(vehicle.x, vehicle.y, ConradWhiteVehicle.attackRange))
  }

  private triggerTruckBulletEffect(type: 'fire' | 'ice' | 'explode' | 'blackhole' | 'lightning', x: number, y: number) {
    const src = this.g.player
    const inRange = (t: { x: number; y: number }, r: number) => Phaser.Math.Distance.Between(x, y, t.x, t.y) < r
    const hitBossesWithin = (r: number) => {
      for (const b of [this.g.boss, this.g.boss2]) if (b?.active && inRange(b, r)) this.g.damageBoss(b)
    }

    if (type === 'explode') {
      const RADIUS = 110
      this.g.enemies.forEach(e => { if (this.g.isTargetable(e) && inRange(e, RADIUS)) this.g.hitEnemy(e, src) })
      hitBossesWithin(RADIUS)
    } else if (type === 'blackhole') {
      const RADIUS = 180
      const pulled = this.g.enemies.filter(e => this.g.isTargetable(e) && inRange(e, RADIUS))
      // Repeatedly override enemy velocity toward the impact point for ~600 ms
      for (let t = 0; t < 600; t += 60) {
        this.g.time.delayedCall(t, () => {
          pulled.forEach(e => {
            if (!e.active || e.isDead) return
            const ang = Phaser.Math.Angle.Between(e.x, e.y, x, y)
            ;(e.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * 520, Math.sin(ang) * 520)
          })
        })
      }
      this.g.time.delayedCall(620, () => {
        pulled.forEach(e => { if (e.active) this.g.hitEnemy(e, src) })
        hitBossesWithin(RADIUS)
      })
    } else if (type === 'lightning') {
      const RADIUS = 220
      const targets = this.g.enemies
        .filter(e => this.g.isTargetable(e) && inRange(e, RADIUS))
        .sort((a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y))
        .slice(0, 3)
      targets.forEach(e => this.g.hitEnemy(e, src))
      hitBossesWithin(RADIUS)
      targets.forEach((e, i) => {
        this.g.time.delayedCall(i * 80, () => {
          if (!e.active) return
          const g = this.g.add.graphics().setDepth(15)
          g.lineStyle(3, 0xffff44, 1)
          g.strokeLineShape(new Phaser.Geom.Line(x, y, e.x, e.y))
          this.g.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() })
        })
      })
    }

    const color  = type === 'fire' ? 0xff5500 : type === 'ice' ? 0x22ddff : type === 'explode' ? 0xffee00
                 : type === 'blackhole' ? 0x220033 : 0xffff44
    const radius = type === 'explode' ? 55 : type === 'blackhole' ? 65 : 18
    const flash  = this.g.add.circle(x, y, radius, color, 0.9).setDepth(15)

    if (type === 'blackhole') {
      this.g.tweens.add({
        targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0.4, duration: 300,
        onComplete: () => {
          this.g.tweens.add({ targets: flash, scaleX: 0, scaleY: 0, alpha: 0, duration: 350,
            onComplete: () => { if (flash.active) flash.destroy() } })
        },
      })
    } else {
      this.g.tweens.add({
        targets: flash,
        scaleX: type === 'explode' ? 4 : 2.5, scaleY: type === 'explode' ? 4 : 2.5,
        alpha: 0,
        duration: type === 'explode' ? 420 : 240,
        onComplete: () => { if (flash.active) flash.destroy() },
      })
    }
  }
}
