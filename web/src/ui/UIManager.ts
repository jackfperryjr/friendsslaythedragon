import Phaser from 'phaser'
import { Player } from '../game/Player'

const FONT = '"Press Start 2P", monospace'

export class UIManager {
  private scene: Phaser.Scene
  private heartIcons: Phaser.GameObjects.Image[][] = []
  private rowYs: number[] = []
  private bossBarFill: Phaser.GameObjects.Rectangle | null = null
  private bossHudObjects: Phaser.GameObjects.GameObject[] = []
  private speedBoostIcons: Phaser.GameObjects.Image[] = []
  private strengthBoostIcons: Phaser.GameObjects.Image[] = []
  private invulnerabilityIcons: Phaser.GameObjects.Image[] = []
  private letterSlots: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = []

  constructor(
    scene: Phaser.Scene,
    playerCount: number,
    _worldName = '',
    isBossRoom = false,
    bossMaxHp = 0,
    bossName = 'BOSS',
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
    }

    const ROW_H    = 42
    const HEAD_SZ  = 56
    const HEAD_CX  = 32
    const SHIFT    = 40
    // Super-ability icons start where the old elemental slot was (ABX),
    // but now there's no elemental slot so they begin directly after hearts.
    const SUPER_X  = 172 + SHIFT   // first super-ability icon center-x
    const FALLBACK_COLORS = [0xffe066, 0x00ccff, 0x44ff88, 0xff8c00]

    const selectedChars: string[] | undefined = scene.registry.get('selectedChars')

    for (let i = 0; i < playerCount; i++) {
      const rowY = 22 + i * ROW_H
      this.rowYs.push(rowY)

      scene.add.rectangle(160, rowY, 320, ROW_H, 0x000000, 0.82)
        .setScrollFactor(0).setDepth(19)

      const charKey   = selectedChars?.[i]
      const headKey   = charKey ? `head-${charKey}` : ''
      const hasHead   = headKey !== '' && scene.textures.exists(headKey)
      if (hasHead) {
        scene.add.image(HEAD_CX, rowY, headKey)
          .setDisplaySize(HEAD_SZ, HEAD_SZ)
          .setScrollFactor(0).setDepth(21)
      } else {
        scene.add.rectangle(HEAD_CX, rowY, HEAD_SZ, HEAD_SZ, FALLBACK_COLORS[i] ?? 0x888888, 0.6)
          .setScrollFactor(0).setDepth(21)
      }

      const hearts: Phaser.GameObjects.Image[] = []
      for (let h = 0; h < 5; h++) {
        const icon = scene.add.image(16 + SHIFT + h * 22 + 8, rowY, 'item-heart')
          .setScale(0.48).setScrollFactor(0).setDepth(20)
        hearts.push(icon)
      }
      this.heartIcons.push(hearts)

      // Speed, strength, invulnerability icons (super abilities)
      const speedIcon = scene.add.image(SUPER_X, rowY, 'speed_boost_icon')
        .setDisplaySize(28, 28).setAlpha(0.25).setScrollFactor(0).setDepth(21)
      const strengthIcon = scene.add.image(SUPER_X + 30, rowY, 'strength_boost_icon')
        .setDisplaySize(28, 28).setAlpha(0.25).setScrollFactor(0).setDepth(21)
      const invulnIcon = scene.add.image(SUPER_X + 60, rowY, 'invulnerability_icon')
        .setDisplaySize(20, 20).setAlpha(0.25).setScrollFactor(0).setDepth(21)

      this.speedBoostIcons.push(speedIcon)
      this.strengthBoostIcons.push(strengthIcon)
      this.invulnerabilityIcons.push(invulnIcon)
    }

    // Letter bug tray — up to 5 collected-letter slots, offset from player HUD with a gap
    const LETTER_Y = 22
    const LETTER_START_X = 350  // 30px gap after the player HUD block (~320px wide)
    for (let i = 0; i < 5; i++) {
      const slotX = LETTER_START_X + i * 36
      const bg = scene.add.rectangle(slotX, LETTER_Y, 30, 30, 0x000000, 0.55)
        .setStrokeStyle(1, 0x556677).setScrollFactor(0).setDepth(20)
      const text = scene.add.text(slotX, LETTER_Y + 1, '', {
        fontSize: '12px', fontFamily: FONT, color: '#ffe066',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(21)
      this.letterSlots.push({ bg, text })
    }
  }

  update(players: Player[]) {
    players.forEach((p, i) => {
      this.heartIcons[i]?.forEach((icon, h) => icon.setAlpha(h < p.hearts ? 1 : 0.2))
      this.speedBoostIcons[i]?.setAlpha(p.speedBoostActive ? 1 : 0.25)
      this.strengthBoostIcons[i]?.setAlpha(p.strengthBoostActive ? 1 : 0.25)
      this.invulnerabilityIcons[i]?.setAlpha(p.invulnerabilityActive ? 1 : 0.25)
    })
  }

  updateBossBar(current: number, max: number) {
    if (!this.bossBarFill) return
    const pct = max > 0 ? Math.max(0, current / max) : 0
    this.bossBarFill.width = Math.round(200 * pct)
  }

  updateLetters(letters: string[]) {
    this.letterSlots.forEach((slot, i) => {
      slot.text.setText(letters[i] ?? '')
    })
  }

  hideBossBar() {
    if (!this.bossHudObjects.length) return
    const targets = this.bossHudObjects
    this.bossHudObjects = []
    this.bossBarFill = null
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 600,
      onComplete: () => targets.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy()),
    })
  }
}
