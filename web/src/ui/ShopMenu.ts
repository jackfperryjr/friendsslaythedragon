import Phaser from 'phaser'
import { SoundManager } from '../audio/SoundManager'
import { MenuNav } from './MenuNav'

const FONT = '"Press Start 2P", monospace'
const DEPTH = 160  // above the pause menu (100)

export interface ShopItem {
  name: string
  desc: string
  price: number
  /** Why it can't be bought right now (e.g. "HEARTS FULL"), or null if it can. */
  unavailable?: () => string | null
  buy: () => void
}

/**
 * The coin shop, opened from the pause menu. Lists items with prices;
 * buying spends gold coins. Navigable with keyboard, gamepad, mouse or touch.
 */
export class ShopMenu {
  private objects: Phaser.GameObjects.GameObject[] = []
  private nav: MenuNav
  private onClose: (() => void) | null = null

  constructor(
    private scene: Phaser.Scene,
    private coins: { get: () => number; spend: (n: number) => void },
  ) {
    this.nav = new MenuNav(scene, { depth: DEPTH + 2, cursorSize: 14, activateButtons: [0] })
    this.nav.enabled = false
  }

  get isOpen(): boolean {
    return this.objects.length > 0
  }

  open(items: ShopItem[], onClose: () => void) {
    if (this.isOpen) return
    this.onClose = onClose
    const { width, height } = this.scene.scale
    const cx = width / 2
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.objects.push(o); return o }
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject>(o: T): T =>
      add(o.setScrollFactor(0).setDepth(DEPTH) as T)

    fixed(this.scene.add.rectangle(cx, height / 2, width, height, 0x000000, 0.88).setInteractive())
    fixed(this.scene.add.text(cx, height * 0.14, 'SHOP', {
      fontSize: '28px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5))
    const wallet = fixed(this.scene.add.text(cx, height * 0.22, '', {
      fontSize: '11px', fontFamily: FONT, color: '#ffd700', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5))
    const message = fixed(this.scene.add.text(cx, height * 0.86, '', {
      fontSize: '10px', fontFamily: FONT, color: '#ff8888', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5))

    const refreshWallet = () => wallet.setText(`YOUR COINS: ${this.coins.get()}`)
    refreshWallet()

    const say = (text: string, color: string) => {
      message.setText(text).setColor(color).setAlpha(1)
      this.scene.tweens.killTweensOf(message)
      this.scene.tweens.add({ targets: message, alpha: 0, delay: 1200, duration: 400 })
    }

    const navItems: { text: Phaser.GameObjects.Text; action: () => void }[] = []
    const rowH = Math.min(52, (height * 0.56) / (items.length + 1))
    items.forEach((item, i) => {
      const y = height * 0.30 + i * rowH
      const row = fixed(this.scene.add.text(cx - 240, y, item.name, {
        fontSize: '13px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }))
      fixed(this.scene.add.text(cx - 240, y + 17, item.desc, {
        fontSize: '8px', fontFamily: FONT, color: '#8899aa',
      }).setOrigin(0, 0.5))
      fixed(this.scene.add.text(cx + 240, y, `${item.price}`, {
        fontSize: '13px', fontFamily: FONT, color: '#ffd700', stroke: '#000', strokeThickness: 3,
      }).setOrigin(1, 0.5))

      const buy = () => {
        const reason = item.unavailable?.() ?? null
        if (reason) { say(reason, '#ff8888'); return }
        if (this.coins.get() < item.price) { say('NOT ENOUGH COINS', '#ff8888'); return }
        this.coins.spend(item.price)
        item.buy()
        SoundManager.collectAbility()
        refreshWallet()
        say(`BOUGHT ${item.name}!`, '#88ff88')
      }
      row.on('pointerover', () => row.setColor('#ffe066'))
      row.on('pointerout',  () => row.setColor('#ffffff'))
      row.on('pointerdown', buy)
      navItems.push({ text: row, action: buy })
    })

    const back = fixed(this.scene.add.text(cx, height * 0.30 + items.length * rowH + 10, '< BACK', {
      fontSize: '13px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }))
    back.on('pointerover', () => back.setColor('#ffe066'))
    back.on('pointerout',  () => back.setColor('#ffffff'))
    back.on('pointerdown', () => this.close())
    navItems.push({ text: back, action: () => this.close() })

    this.nav.setItems(navItems)
    this.nav.move(0)
    // Start listening next frame: the Enter / A press that opened the shop is
    // still being dispatched and would otherwise buy the first item.
    requestAnimationFrame(() => { if (this.isOpen) this.nav.enabled = true })
  }

  close() {
    if (!this.isOpen) return
    this.nav.enabled = false
    this.nav.hideCursor()
    this.objects.forEach(o => o.active && o.destroy())
    this.objects = []
    const done = this.onClose
    this.onClose = null
    done?.()
  }
}
