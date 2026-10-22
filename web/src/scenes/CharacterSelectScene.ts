import Phaser from 'phaser'
import { BootScene } from './BootScene'
import { SoundManager } from '../audio/SoundManager'
import { loadSettings, updateSettings } from '../game/settings'

const FONT = '"Press Start 2P", monospace'
const CURSOR_COLOR = 0xffe066

type CharInfo = { key: string; name: string; sheetKey: string; animPrefix: string; previewFrame: number }

// 7 characters fit in two rows: 4 top, 3 bottom (centered)
const CARD_W  = 148
const CARD_H  = 190
const GAP     = 16

export class CharacterSelectScene extends Phaser.Scene {
  private chars: CharInfo[] = []
  private selection = 0
  private cursor!: Phaser.GameObjects.Rectangle
  private cards: { x: number; y: number }[] = []
  private startText!: Phaser.GameObjects.Text
  private backBtn!: Phaser.GameObjects.Text
  private backCursor!: Phaser.GameObjects.Text
  private backFocused = false
  private started = false

  constructor() { super({ key: 'CharacterSelectScene' }) }

  create() {
    SoundManager.whenUnlocked(() => SoundManager.startTrack(this.sound, 'music-title'))

    const { width, height } = this.scale
    this.started     = false
    this.backFocused = false
    this.chars       = BootScene.getSelectableCharacters()
    // Start on the character picked last time, if it still exists
    const lastKey: string | null = this.registry.get('selectedChars')?.[0] ?? loadSettings().lastCharacter
    this.selection   = Math.max(0, this.chars.findIndex(c => c.key === lastKey))

    this.add.rectangle(width / 2, height / 2, width, height, 0x080818)
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0030, 0.45)

    this.add.text(width / 2, 44, 'CHOOSE YOUR CHARACTER', {
      fontSize: '16px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5)

    // Layout: row0 = first 4 chars, row1 = remaining chars (centered)
    this.cards = []
    const rowSplit  = 4
    const row0Count = Math.min(this.chars.length, rowSplit)
    const row1Count = Math.max(0, this.chars.length - rowSplit)
    const row0Y = Math.round(height * 0.38)
    const row1Y = Math.round(height * 0.38) + CARD_H + GAP + 10

    const buildRow = (startIdx: number, count: number, rowY: number) => {
      const rowW = count * CARD_W + (count - 1) * GAP
      const rowX = (width - rowW) / 2 + CARD_W / 2
      for (let i = 0; i < count; i++) {
        const ci = startIdx + i
        const cx = Math.round(rowX + i * (CARD_W + GAP))
        this.cards[ci] = { x: cx, y: rowY }
        this.buildCard(cx, rowY, this.chars[ci])

        // Touch / click — tap once to select, tap again to confirm
        const zone = this.add.zone(cx, rowY, CARD_W, CARD_H).setInteractive().setDepth(8)
        zone.on('pointerdown', () => {
          if (this.started) return
          if (this.selection === ci) this.confirm()
          else this.select(ci)
        })
      }
    }

    buildRow(0,         row0Count, row0Y)
    if (row1Count > 0) buildRow(row0Count, row1Count, row1Y)

    this.cursor = this.add.rectangle(0, 0, CARD_W + 10, CARD_H + 10, 0, 0)
      .setStrokeStyle(3, CURSOR_COLOR)
      .setDepth(5)
    this.updateCursorPos()

    this.startText = this.add.text(width / 2, height - 72, 'TAP A CHARACTER TO CONFIRM', {
      fontSize: '10px', fontFamily: FONT, color: '#556677',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5)

    this.backBtn = this.add.text(width / 2, height - 38, '< BACK', {
      fontSize: '10px', fontFamily: FONT, color: '#7799aa',
      stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000044', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10)
    this.backCursor = this.add.text(0, height - 38, '►', {
      fontSize: '10px', fontFamily: FONT, color: '#ffe066',
    }).setOrigin(1, 0.5).setDepth(10).setVisible(false)

    this.backBtn.on('pointerover', () => this.backBtn.setStyle({ color: '#ffffff' }))
    this.backBtn.on('pointerout',  () => this.backBtn.setStyle({ color: this.backFocused ? '#ffffff' : '#7799aa' }))
    this.backBtn.on('pointerdown', () => this.goBack())

    // Keyboard — WASD and arrow keys both work
    const kb = this.input.keyboard!
    const onKey = (key: string | number, fn: () => void) => kb.addKey(key).on('down', fn)
    const left  = () => { if (!this.backFocused) this.move(-1) }
    const right = () => { if (!this.backFocused) this.move(1) }
    const up    = () => { if (this.backFocused) this.focusBack(false); else this.confirm() }
    const down  = () => this.focusBack(true)
    const enter = () => { if (this.backFocused) this.goBack(); else this.confirm() }
    onKey('A', left);  onKey(Phaser.Input.Keyboard.KeyCodes.LEFT,  left)
    onKey('D', right); onKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, right)
    onKey('W', up);    onKey(Phaser.Input.Keyboard.KeyCodes.UP,    up)
    onKey('S', down);  onKey(Phaser.Input.Keyboard.KeyCodes.DOWN,  down)
    onKey(Phaser.Input.Keyboard.KeyCodes.ENTER, enter)
    onKey(Phaser.Input.Keyboard.KeyCodes.SPACE, enter)
    onKey(Phaser.Input.Keyboard.KeyCodes.ESC,   () => this.goBack())

    // Gamepad — any connected controller drives the selection
    this.input.gamepad?.on(
      Phaser.Input.Gamepad.Events.BUTTON_DOWN,
      (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        if (button.index === 13) { this.focusBack(true);  return }
        if (button.index === 12) { if (this.backFocused) this.focusBack(false); return }
        if (button.index === 14) left()
        if (button.index === 15) right()
        if (button.index === 0 || button.index === 9) enter()
        if (button.index === 1)  this.goBack()
      },
    )
  }

  private buildCard(cx: number, cy: number, char: CharInfo) {
    this.add.rectangle(cx, cy, CARD_W, CARD_H, 0x111128).setStrokeStyle(1, 0x223355)

    if (this.textures.exists(char.sheetKey)) {
      this.add.image(cx, cy - 18, char.sheetKey, char.previewFrame).setScale(2.5).setDepth(2)
    } else {
      this.add.rectangle(cx, cy - 18, 64, 64, 0x334466).setDepth(2)
    }

    this.add.text(cx, cy + 75, char.name, {
      fontSize: '8px', fontFamily: FONT, color: '#aaccdd',
    }).setOrigin(0.5).setDepth(2)
  }

  private select(idx: number) {
    if (this.started) return
    this.selection = idx
    this.updateCursorPos()
  }

  private move(dir: number) {
    this.select((this.selection + dir + this.chars.length) % this.chars.length)
  }

  private confirm() {
    if (this.started) return
    this.started = true
    this.startText.setText('READY!').setColor('#ffe066')
    const key = this.chars[this.selection].key
    this.registry.set('selectedChars', [key])
    updateSettings({ lastCharacter: key })
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private updateCursorPos() {
    const card = this.cards[this.selection]
    if (card) this.cursor.setPosition(card.x, card.y)
  }

  private focusBack(on: boolean) {
    this.backFocused = on
    this.backBtn.setStyle({ color: on ? '#ffffff' : '#7799aa' })
    if (on) {
      const b = this.backBtn.getBounds()
      this.backCursor.setPosition(b.left - 6, b.centerY)
    }
    this.backCursor.setVisible(on)
  }

  private goBack() {
    if (this.started) return
    this.started = true
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'))
  }
}
