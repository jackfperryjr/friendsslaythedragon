import Phaser from 'phaser'
import { MenuNav } from '../ui/MenuNav'
import { SoundManager } from '../audio/SoundManager'
import { generateRun } from '../levels'
import { resetRunState, STARTING_LIVES } from '../game/runState'
import { clearSavedRun } from '../game/savedRun'

const FONT = '"Press Start 2P", monospace'

export class VictoryScene extends Phaser.Scene {
  private nav!: MenuNav

  constructor() { super({ key: 'VictoryScene' }) }

  create() {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2

    this.cameras.main.setBackgroundColor('#000000')
    this.cameras.main.fadeIn(700, 0, 0, 0)

    this.nav = new MenuNav(this, { colors: null, cursorColor: '#ffe066' })

    this.spawnStars(width, height)
    this.buildUI(cx, cy)

    clearSavedRun()  // the run is won; "Continue Exploring" starts a new save on its first room
    SoundManager.stopTrack()
    SoundManager.startVictoryMusic()
    this.events.once('shutdown', () => SoundManager.stopVictoryMusic())
  }

  private spawnStars(width: number, height: number) {
    for (let i = 0; i < 90; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const sz = Math.random() < 0.25 ? 3 : Math.random() < 0.5 ? 2 : 1
      const star = this.add.rectangle(x, y, sz, sz, 0xffffff, 0.4 + Math.random() * 0.5)
      this.tweens.add({
        targets: star, alpha: { from: 0.05, to: 0.95 },
        duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1,
        delay: Math.random() * 2500,
      })
    }
  }

  private buildUI(cx: number, cy: number) {
    const { height } = this.scale
    // Title — slides down from above
    const title = this.add.text(cx, cy - 260, 'YOU WIN!', {
      fontSize: '60px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 12,
    }).setOrigin(0.5).setAlpha(0)

    // Message lines
    const msg1 = this.add.text(cx, cy - 70, 'ALL ENEMIES DEFEATED!', {
      fontSize: '18px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0)

    const msg2 = this.add.text(cx, cy - 30, 'THE DUNGEON IS YOURS!', {
      fontSize: '18px', fontFamily: FONT, color: '#ffb3c6',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0)

    // Separator
    const sep = this.add.rectangle(cx, cy + 30, 400, 1, 0x334466, 0).setOrigin(0.5)

    // Stats
    const pizzas    = this.registry.get('pizzasCollected')    ?? 0
    const furniture = this.registry.get('furnitureDestroyed') ?? 0
    const coins     = this.registry.get('goldCoins')          ?? 0
    const statStyle = { fontSize: '11px', fontFamily: FONT, color: '#aaccff', stroke: '#000', strokeThickness: 3 }
    const valStyle  = { fontSize: '11px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 3 }
    const statRows: Phaser.GameObjects.Text[] = []
    const stats: [string, number][] = [
      ['PIZZAS EATEN', pizzas],
      ['FURNITURE SMASHED', furniture],
      ['GOLD COINS', coins],
    ]
    stats.forEach(([label, val], i) => {
      const rowY = cy + 60 + i * 38
      statRows.push(this.add.text(cx - 20, rowY, label + ':', statStyle).setOrigin(1, 0.5).setAlpha(0))
      statRows.push(this.add.text(cx + 20, rowY, String(val), valStyle).setOrigin(0, 0.5).setAlpha(0))
    })

    // Buttons — stacked at bottom centre; Continue on top as primary action
    const btnContinue = this.menuButton(cx, height - 130, 'CONTINUE EXPLORING').setAlpha(0)
    const btnMenu     = this.menuButton(cx, height -  70, 'MAIN MENU').setAlpha(0)

    // Only the first choice counts (a double press would start two scenes)
    let leaving = false
    btnMenu.on('pointerdown', () => {
      if (leaving) return
      leaving = true
      btnMenu.disableInteractive(); btnContinue.disableInteractive()
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => {
        resetRunState(this.registry)
        this.scene.start('MenuScene')
      })
    })

    btnContinue.on('pointerdown', () => {
      if (leaving) return
      leaving = true
      btnMenu.disableInteractive(); btnContinue.disableInteractive()
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => {
        // Drop back into the castle after the Celery Man fight; everything won so far is kept
        this.registry.set('runRooms',             generateRun())
        this.registry.set('runIndex',             5)   // BOSS_THREE_ROOM = Celery Man's Lair
        this.registry.set('entryDir',             'left')
        this.registry.set('skeletonKingDefeated', true)
        this.registry.set('zombieKingDefeated',   true)
        this.registry.set('celeryManDefeated',    true)
        this.registry.set('dadSaved',             true)
        this.registry.set('momSaved',             true)
        this.registry.set('persistedHearts',      null)
        this.registry.set('lives',                STARTING_LIVES)
        this.scene.start('GameScene')
      })
    })

    // Register buttons for gamepad navigation — Continue is index 0 (default focus)
    this.nav.setItems([
      { text: btnContinue, action: () => btnContinue.emit('pointerdown') },
      { text: btnMenu,     action: () => btnMenu.emit('pointerdown')     },
    ])

    // Animation sequence
    this.tweens.add({
      targets: title,
      y: cy - 200, alpha: 1,
      duration: 750, ease: 'Back.Out', delay: 200,
      onComplete: () => {
        // Gentle pulse on title
        this.tweens.add({
          targets: title, scaleX: 1.03, scaleY: 1.03,
          duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        })

        this.tweens.add({ targets: msg1, alpha: 1, duration: 400, delay: 150 })
        this.tweens.add({
          targets: msg2, alpha: 1, duration: 400, delay: 350,
          onComplete: () => {
            this.tweens.add({ targets: sep, alpha: 0.5, duration: 500 })
            this.tweens.add({ targets: statRows, alpha: 1, duration: 400, delay: 100 })
            this.tweens.add({ targets: [btnContinue, btnMenu], alpha: 1, duration: 400, delay: 300 })
          },
        })
      },
    })

    // Burst of particles on entry (simple circles flying outward)
    this.time.delayedCall(250, () => this.fireBurst(cx, cy - 200))
  }

  private fireBurst(cx: number, cy: number) {
    const colors = [0xffe066, 0xff80ab, 0x80d8ff, 0xffffff, 0xffaa00]
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2
      const speed = 160 + Math.random() * 180
      const c = this.add.rectangle(cx, cy, 5, 5, Phaser.Math.RND.pick(colors), 1)
      this.tweens.add({
        targets: c,
        x: cx + Math.cos(angle) * speed * (1.5 + Math.random()),
        y: cy + Math.sin(angle) * speed * (0.6 + Math.random()),
        alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 900 + Math.random() * 400,
        ease: 'Quad.Out',
        onComplete: () => c.destroy(),
      })
    }
  }

  private menuButton(x: number, y: number, label: string) {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000055', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => btn.setColor('#ffe066'))
    btn.on('pointerout',  () => btn.setColor('#ffffff'))
    return btn
  }
}
