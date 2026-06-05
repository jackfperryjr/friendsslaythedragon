import Phaser from 'phaser'
import { SoundManager } from '../audio/SoundManager'
import { generateRun } from '../levels'
import type { RoomConfig } from '../levels'

type Screen = 'main' | 'controls' | 'devMenu'

const _wsUrl: string = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WS_URL ?? 'ws://localhost:3001'
const SERVER_URL = _wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')

const FONT = '"Press Start 2P", monospace'
const CLR_TITLE  = '#ffe066'
const CLR_SELECT = '#ffffff'
const CLR_DIM    = '#7799aa'
const CLR_BODY   = '#aaccdd'

interface MenuItem { text: Phaser.GameObjects.Text; action: () => void }

export class MenuScene extends Phaser.Scene {
  private mainGroup!: Phaser.GameObjects.Container
  private controlsGroup!: Phaser.GameObjects.Container
  private devMenuGroup!: Phaser.GameObjects.Container

  private gpCursor!: Phaser.GameObjects.Text
  private padStatus!: Phaser.GameObjects.Text
  private activeItems: MenuItem[] = []
  private focusIdx = 0

  constructor() { super({ key: 'MenuScene' }) }

  create() {
    this.activeItems = []
    SoundManager.stopTrack()
    const { width, height } = this.scale

    this.cameras.main.fadeIn(400, 0, 0, 0)
    this.add.image(width / 2, height / 2, 'logo').setDisplaySize(width, height)

    this.gpCursor = this.add.text(0, 0, '►', {
      fontSize: '14px', fontFamily: FONT, color: CLR_TITLE,
    }).setOrigin(1, 0.5).setDepth(20).setVisible(false)

    this.padStatus = this.add.text(width / 2, height - 10, '', {
      fontSize: '8px', fontFamily: FONT, color: '#44cc88',
    }).setOrigin(0.5, 1).setDepth(20)

    this.buildMain()
    this.buildControls()
    this.buildDevMenu()
    this.showScreen('main')
    this.setupGamepad()
    this.setupControllerStatus()

    // Dev shortcut: press 4 to jump directly to Level 4 (outside world)
    this.input.keyboard?.once('keydown-FOUR', () => this.startLevel4())

    SoundManager.whenUnlocked(() => {
      SoundManager.playIntroTheme()
      SoundManager.startTrack(this.sound, 'music-title')
    })
  }

  private setupControllerStatus() {
    const refresh = () => {
      const pads = this.input.gamepad?.gamepads ?? []
      const connected = pads.some(p => p != null)
      if (connected) {
        this.padStatus.setText('● CONTROLLER CONNECTED').setColor('#44cc88')
      } else if ('ontouchstart' in window) {
        this.padStatus.setText('● PRESS ANY BUTTON ON YOUR CONTROLLER TO CONNECT').setColor('#ffe066')
      } else {
        this.padStatus.setText('')
      }
    }

    refresh()
    this.input.gamepad?.on(Phaser.Input.Gamepad.Events.CONNECTED,    refresh)
    this.input.gamepad?.on(Phaser.Input.Gamepad.Events.DISCONNECTED, refresh)
    // Re-check every 2 s in case the event fired before this scene was ready
    this.time.addEvent({ delay: 2000, loop: true, callback: refresh })
  }

  private setupGamepad() {
    this.input.gamepad?.on(
      Phaser.Input.Gamepad.Events.BUTTON_DOWN,
      (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        if (button.index === 12) this.moveFocus(-1)          // d-pad up
        if (button.index === 13) this.moveFocus(1)           // d-pad down
        if (button.index === 0 || button.index === 9) this.activateFocus()  // A or Start
      },
    )
  }

  private moveFocus(dir: number) {
    const len = this.activeItems.length
    if (!len) return
    this.focusIdx = (this.focusIdx + dir + len) % len
    this.placeCursor()
  }

  private activateFocus() {
    this.activeItems[this.focusIdx]?.action()
  }

  private placeCursor() {
    const item = this.activeItems[this.focusIdx]
    if (!item) return
    this.activeItems.forEach(it => it.text.setColor(CLR_SELECT))
    item.text.setColor(CLR_TITLE)
    const b = item.text.getBounds()
    this.gpCursor.setPosition(b.left - 10, b.centerY).setVisible(true)
  }

  private setActiveItems(items: MenuItem[]) {
    this.activeItems.forEach(it => it.text.setColor(CLR_SELECT))
    this.activeItems = items
    this.focusIdx = 0
    this.gpCursor.setVisible(false)
  }

  private buildMain() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []

    const btn1P  = this.menuButton(width / 2, height * 0.79, '1  PLAYER')
    const btn24P = this.menuButton(width / 2, height * 0.84, '2-4  PLAYERS')
    const btnCt  = this.menuButton(width / 2, height * 0.89, 'CONTROLS')

    const startGame = () => this.startGame(1)
    const goLobby   = () => {
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('LobbyScene'))
    }
    const goControls = () => this.showScreen('controls')

    btn1P.on('pointerdown',  startGame)
    btn24P.on('pointerdown', goLobby)
    btnCt.on('pointerdown',  goControls)

    const tip = this.add.text(width / 2, height - 28, '♦  Bluetooth controllers supported  ♦', {
      fontSize: '9px', fontFamily: FONT, color: CLR_DIM,
    }).setOrigin(0.5)

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const gpItems: MenuItem[] = [
      { text: btn1P,  action: startGame  },
      { text: btn24P, action: goLobby    },
      { text: btnCt,  action: goControls },
    ]

    items.push(btn1P, btn24P, btnCt, tip)

    if (isLocalhost) {
      const goDevMenu = () => this.showScreen('devMenu')
      const btnDev = this.add.text(width / 2, height * 0.95, 'DEV', {
        fontSize: '10px', fontFamily: FONT, color: '#ff4444',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      btnDev.on('pointerover', () => btnDev.setColor('#ffaaaa'))
      btnDev.on('pointerout',  () => btnDev.setColor('#ff4444'))
      btnDev.on('pointerdown', goDevMenu)
      items.push(btnDev)
      gpItems.push({ text: btnDev, action: goDevMenu })
    }

    this.mainGroup = this.add.container(0, 0, items)
    this.mainGroup.setData('gpItems', gpItems)
  }

  private buildControls() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []
    const cx = width / 2, cy = height / 2

    // Dark panel matching the main menu style
    const panel = this.add.rectangle(cx, cy + 15, 640, 490, 0x000000, 0.78)
      .setStrokeStyle(1, 0x334466, 0.7)

    const header = this.add.text(cx, cy - 215, 'CONTROLS', {
      fontSize: '22px', fontFamily: FONT, color: CLR_TITLE,
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5)

    // Accent line under title
    const titleSep = this.add.rectangle(cx, cy - 186, 560, 1, 0x334466, 0.9)

    // Three-column layout centered on screen
    const colLabel = cx - 265
    const colKB    = cx - 55
    const colGP    = cx + 140

    let y = cy - 168

    // Column headers
    const h0 = this.add.text(colLabel, y, 'ACTION',   { fontSize: '9px', fontFamily: FONT, color: '#556677' }).setOrigin(0, 0)
    const h1 = this.add.text(colKB,    y, 'KEYBOARD', { fontSize: '9px', fontFamily: FONT, color: CLR_SELECT }).setOrigin(0, 0)
    const h2 = this.add.text(colGP,    y, 'GAMEPAD',  { fontSize: '9px', fontFamily: FONT, color: CLR_SELECT }).setOrigin(0, 0)
    y += 20
    const colSep = this.add.rectangle(cx, y, 560, 1, 0x334466, 0.55)
    y += 18

    const row = (label: string, kb: string, gp: string) => {
      const r = [
        this.add.text(colLabel, y, label, { fontSize: '9px', fontFamily: FONT, color: CLR_DIM  }).setOrigin(0, 0),
        this.add.text(colKB,    y, kb,    { fontSize: '9px', fontFamily: FONT, color: CLR_BODY }).setOrigin(0, 0),
        this.add.text(colGP,    y, gp,    { fontSize: '9px', fontFamily: FONT, color: CLR_BODY }).setOrigin(0, 0),
      ]
      y += 30
      return r
    }

    const rows = [
      ...row('MOVE',    'A / D',   'Left Stick'),
      ...row('JUMP',    'W',       'Cross  /  A'),
      ...row('FLOAT',   'Hold W',  'Hold Cross'),
      ...row('SHIELD',  'C',       'Triangle  /  Y'),
      ...row('ABILITY', 'X',       'Circle  /  B'),
      ...row('MELEE',   'Z',       'Square  /  X'),
      ...row('PAUSE',   'ESC',     'Start'),
    ]
    y += 10

    const note = this.add.text(cx, y, '2 players: keyboard  OR  2 Bluetooth controllers', {
      fontSize: '8px', fontFamily: FONT, color: CLR_DIM, align: 'center',
    }).setOrigin(0.5, 0)

    const goBack = () => this.showScreen('main')
    const back = this.menuButton(cx, cy + 215, '< BACK')
    back.on('pointerdown', goBack)

    items.push(panel, header, titleSep, h0, h1, h2, colSep, ...rows, note, back)
    this.controlsGroup = this.add.container(0, 0, items)
    this.controlsGroup.setData('gpItems', [{ text: back, action: goBack }])
  }

  private showScreen(s: Screen) {
    this.mainGroup.setVisible(s === 'main')
    this.controlsGroup.setVisible(s === 'controls')
    this.devMenuGroup.setVisible(s === 'devMenu')
    const group = s === 'main' ? this.mainGroup : s === 'controls' ? this.controlsGroup : this.devMenuGroup
    this.setActiveItems(group.getData('gpItems') as MenuItem[])
  }

  private menuButton(x: number, y: number, label: string) {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: FONT, color: CLR_SELECT,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setColor(CLR_TITLE))
    btn.on('pointerout',  () => btn.setColor(CLR_SELECT))
    return btn
  }

  private startLevel4() {
    SoundManager.unlock()
    const rooms = generateRun()
    this.registry.set('runRooms',    rooms)
    this.registry.set('runIndex',    8)       // LEVEL4_WORLD_ROOM is index 8
    this.registry.set('entryDir',    null)    // null → no left exit added, spawns at safe center
    this.registry.set('playerCount', 1)
    this.registry.set('lives',       3)
    this.registry.set('score',       0)
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
  }

  private buildDevMenu() {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2

    const mainRooms = generateRun()
    const devRooms  = mainRooms

    const panel = this.add.rectangle(cx, cy, 600, 570, 0x000000, 0.92)
      .setStrokeStyle(1, 0xaa0000, 0.9)

    const header = this.add.text(cx, cy - 262, 'DEV: SELECT LEVEL', {
      fontSize: '14px', fontFamily: FONT, color: '#ff4444',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5)

    const goBack = () => this.showScreen('main')
    const back = this.menuButton(cx, cy + 310, '< BACK')
    back.on('pointerdown', goBack)

    const gpItems: MenuItem[] = []
    const rowItems: Phaser.GameObjects.GameObject[] = []
    let y = cy - 232

    mainRooms.forEach((room, i) => {
      const prefix = String(i).padStart(2, '0')
      const label  = `[${prefix}]  ${room.name}`
      const btn = this.add.text(cx, y, label, {
        fontSize: '10px', fontFamily: FONT, color: CLR_SELECT,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      btn.on('pointerover', () => btn.setColor(CLR_TITLE))
      btn.on('pointerout',  () => btn.setColor(CLR_SELECT))
      btn.on('pointerdown', () => this.startAtLevel(i, devRooms))
      gpItems.push({ text: btn, action: () => this.startAtLevel(i, devRooms) })
      rowItems.push(btn)
      y += 24
    })

    this.devMenuGroup = this.add.container(0, 0, [panel, header, ...rowItems, back])
    this.devMenuGroup.setData('gpItems', [...gpItems, { text: back, action: goBack }])
  }

  private startAtLevel(index: number, rooms?: RoomConfig[]) {
    SoundManager.unlock()
    const r = rooms ?? generateRun()
    this.registry.set('runRooms',    r)
    this.registry.set('runIndex',    index)
    this.registry.set('entryDir',    null)
    this.registry.set('playerCount', 1)
    this.registry.set('lives',       3)
    this.registry.set('score',       0)
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
  }

  private startGame(playerCount: number) {
    fetch(`${SERVER_URL}/ping`).catch(() => {})
    SoundManager.unlock()
    this.registry.set('playerCount',   playerCount)
    this.registry.set('currentLevel',  1)
    this.registry.set('currentRoom',   1)
    this.registry.set('lives',         3)
    this.registry.set('score',         0)
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
  }
}
