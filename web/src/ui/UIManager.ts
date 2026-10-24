import Phaser from 'phaser'
import { Player } from '../game/Player'

const FONT = '"Press Start 2P", monospace'

export class UIManager {
  private scene: Phaser.Scene
  private heartIcons: Phaser.GameObjects.Image[] = []
  private bossBarFill: Phaser.GameObjects.Rectangle | null = null
  private bossBarFill2: Phaser.GameObjects.Rectangle | null = null
  private bossHudObjects: Phaser.GameObjects.GameObject[] = []
  private speedBoostIcon!: Phaser.GameObjects.Image
  private strengthBoostIcon!: Phaser.GameObjects.Image
  private invulnerabilityIcon!: Phaser.GameObjects.Image
  private letterSlots: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = []
  private coinCountText: Phaser.GameObjects.Text | null = null
  private livesText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    _worldName = '',
    isBossRoom = false,
    bossMaxHp = 0,
    bossName = 'BOSS',
    boss2MaxHp = 0,
    boss2Name = '',
  ) {
    this.scene = scene
    const { width } = scene.scale

    if (isBossRoom && bossMaxHp > 0) {
      const bx = width - 110
      const by = 22
      const bossLabel = scene.add.text(bx, by - 10, bossName, {
        fontSize: '8px', fontFamily: FONT, color: '#ff4444',
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20)

      const bossBg = scene.add.rectangle(bx, by, 152, 12, 0x330000)
        .setScrollFactor(0).setDepth(20)

      this.bossBarFill = scene.add.rectangle(bx - 75, by, 150, 10, 0xff2200)
        .setOrigin(0, 0.5)
        .setScrollFactor(0).setDepth(21)

      this.bossHudObjects = [bossLabel, bossBg, this.bossBarFill]

      if (boss2MaxHp > 0 && boss2Name) {
        const by2 = by + 32
        const boss2Label = scene.add.text(bx, by2 - 10, boss2Name, {
          fontSize: '8px', fontFamily: FONT, color: '#ff4444',
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20)
        const boss2Bg = scene.add.rectangle(bx, by2, 152, 12, 0x330000)
          .setScrollFactor(0).setDepth(20)
        this.bossBarFill2 = scene.add.rectangle(bx - 75, by2, 150, 10, 0xff6600)
          .setOrigin(0, 0.5)
          .setScrollFactor(0).setDepth(21)
        this.bossHudObjects.push(boss2Label, boss2Bg, this.bossBarFill2)
      }
    }

    const ROW_H    = 42
    const HEAD_SZ  = 56
    const HEAD_CX  = 32
    const SHIFT    = 40
    // Super-ability icons shifted right to leave room for coin counter between hearts and boosts
    const SUPER_X  = 196 + SHIFT   // first super-ability icon center-x
    const COIN_HUD_X = 172         // coin counter sits between last heart (~152) and first boost icon
    const rowY     = 22

    scene.add.rectangle(160, rowY, 320, ROW_H, 0x000000, 0.82)
      .setScrollFactor(0).setDepth(19)

    const charKey: string | undefined = scene.registry.get('selectedChars')?.[0]
    const headKey = charKey ? `head-${charKey}` : ''
    if (headKey && scene.textures.exists(headKey)) {
      scene.add.image(HEAD_CX, rowY, headKey)
        .setDisplaySize(HEAD_SZ, HEAD_SZ)
        .setScrollFactor(0).setDepth(21)
    } else {
      scene.add.rectangle(HEAD_CX, rowY, HEAD_SZ, HEAD_SZ, 0xffe066, 0.6)
        .setScrollFactor(0).setDepth(21)
    }

    // Lives remaining, in the corner of the portrait
    this.livesText = scene.add.text(HEAD_CX + 20, rowY + 20, '', {
      fontSize: '10px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22)

    for (let h = 0; h < 5; h++) {
      const icon = scene.add.image(16 + SHIFT + h * 22 + 8, rowY, 'item-heart')
        .setScale(0.48).setScrollFactor(0).setDepth(20)
      this.heartIcons.push(icon)
    }

    // Speed, strength, invulnerability icons (super abilities)
    this.speedBoostIcon = scene.add.image(SUPER_X, rowY, 'speed_boost_icon')
      .setDisplaySize(28, 28).setAlpha(0.25).setScrollFactor(0).setDepth(21)
    this.strengthBoostIcon = scene.add.image(SUPER_X + 30, rowY, 'strength_boost_icon')
      .setDisplaySize(28, 28).setAlpha(0.25).setScrollFactor(0).setDepth(21)
    this.invulnerabilityIcon = scene.add.image(SUPER_X + 60, rowY, 'invulnerability_icon')
      .setDisplaySize(20, 20).setAlpha(0.25).setScrollFactor(0).setDepth(21)

    // Coin counter between hearts and boost icons
    const coinGfx = scene.add.graphics().setScrollFactor(0).setDepth(20)
    coinGfx.fillStyle(0xffd700, 1);   coinGfx.fillCircle(COIN_HUD_X, rowY, 6)
    coinGfx.fillStyle(0xffff99, 0.6); coinGfx.fillCircle(COIN_HUD_X - 2, rowY - 2, 2)
    this.coinCountText = scene.add.text(COIN_HUD_X + 10, rowY + 1, '0', {
      fontSize: '9px', fontFamily: FONT, color: '#ffd700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21)

    // Letter bug tray — up to 7 collected-letter slots, below the player HUD rows
    const LETTER_Y = rowY + ROW_H + 8
    const LETTER_START_X = 20  // left-aligned under the HUD
    for (let i = 0; i < 7; i++) {
      const slotX = LETTER_START_X + i * 36
      const bg = scene.add.rectangle(slotX, LETTER_Y, 30, 30, 0x000000, 0.55)
        .setStrokeStyle(1, 0x556677).setScrollFactor(0).setDepth(20)
      const text = scene.add.text(slotX, LETTER_Y + 1, '', {
        fontSize: '12px', fontFamily: FONT, color: '#ffe066',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(21)
      this.letterSlots.push({ bg, text })
    }

    this.scoreText = scene.add.text(LETTER_START_X - 15, LETTER_Y + 26, '', {
      fontSize: '9px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21)
  }

  updateScore(n: number) {
    this.scoreText.setText(`SCORE ${n.toLocaleString('en-US')}`)
  }

  update(player: Player) {
    this.heartIcons.forEach((icon, h) => icon.setAlpha(h < player.hearts ? 1 : 0.2))
    this.speedBoostIcon.setAlpha(player.speedBoostActive ? 1 : 0.25)
    this.strengthBoostIcon.setAlpha(player.strengthBoostActive ? 1 : 0.25)
    this.invulnerabilityIcon.setAlpha(player.invulnerabilityActive ? 1 : 0.25)
  }

  updateBossBar(current: number, max: number) {
    if (!this.bossBarFill) return
    const pct = max > 0 ? Math.max(0, current / max) : 0
    this.bossBarFill.width = Math.round(150 * pct)
  }

  updateBoss2Bar(current: number, max: number) {
    if (!this.bossBarFill2) return
    const pct = max > 0 ? Math.max(0, current / max) : 0
    this.bossBarFill2.width = Math.round(150 * pct)
  }

  updateLetters(letters: string[]) {
    this.letterSlots.forEach((slot, i) => {
      slot.text.setText(letters[i] ?? '')
    })
  }

  updateLives(n: number) {
    const text = `x${Math.max(0, n)}`
    if (this.livesText.text === text) return
    const changed = this.livesText.text !== ''
    this.livesText.setText(text).setColor(n <= 1 ? '#ff6666' : '#ffffff')
    if (changed) {
      this.scene.tweens.add({ targets: this.livesText, scale: { from: 1.8, to: 1 }, duration: 350, ease: 'Back.Out' })
    }
  }

  updateCoinCount(n: number) {
    this.coinCountText?.setText(String(n))
  }

  hideBossBar() {
    if (!this.bossHudObjects.length) return
    const targets = this.bossHudObjects
    this.bossHudObjects = []
    this.bossBarFill = null
    this.bossBarFill2 = null
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 600,
      onComplete: () => targets.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy()),
    })
  }
}
