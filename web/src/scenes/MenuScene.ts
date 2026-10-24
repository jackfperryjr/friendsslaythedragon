import Phaser from 'phaser'
import { SoundManager } from '../audio/SoundManager'
import { generateRun } from '../levels'
import type { RoomConfig } from '../levels'
import { resetRunState } from '../game/runState'
import { setSoundMuted, loadSettings, formatDuration, formatScore } from '../game/settings'
import { savedRunRoomName, loadSavedRun } from '../game/savedRun'
import { MenuNav, MenuItem } from '../ui/MenuNav'
import { onKeyPress } from '../input/keys'

type Screen = 'main' | 'controls' | 'devMenu'

const FONT = '"Press Start 2P", monospace'
const CLR_TITLE  = '#ffe066'
const CLR_SELECT = '#ffffff'
const CLR_DIM    = '#7799aa'
const CLR_BODY   = '#aaccdd'

export class MenuScene extends Phaser.Scene {
  private mainGroup!: Phaser.GameObjects.Container
  private controlsGroup!: Phaser.GameObjects.Container
  private devMenuGroup!: Phaser.GameObjects.Container

  private nav!: MenuNav
  private padStatus!: Phaser.GameObjects.Text

  constructor() { super({ key: 'MenuScene' }) }

  create() {
    SoundManager.stopTrack()
    const { width, height } = this.scale

    this.cameras.main.fadeIn(400, 0, 0, 0)
    this.add.image(width / 2, height / 2, 'logo').setDisplaySize(width, height)

    this.nav = new MenuNav(this, { colors: { normal: CLR_SELECT, focus: CLR_TITLE } })

    this.padStatus = this.add.text(width / 2, height - 10, '', {
      fontSize: '8px', fontFamily: FONT, color: '#44cc88',
    }).setOrigin(0.5, 1).setDepth(20)

    this.buildMain()
    this.buildControls()
    this.buildDevMenu()
    this.showScreen('main')
    this.setupControllerStatus()
    onKeyPress(this, e => { if (e.code === 'Escape') this.showScreen('main') })

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

  private buildMain() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []

    // CONTINUE only appears when a run is saved; the other buttons shift down to make room
    const savedRoom = savedRunRoomName()
    const ROW = 0.045
    let y = savedRoom ? 0.775 : 0.79
    const btnCont = savedRoom ? this.menuButton(width / 2, height * y, `CONTINUE · ${savedRoom.toUpperCase()}`) : null
    if (btnCont) y += ROW
    const btn1P  = this.menuButton(width / 2, height * y, savedRoom ? 'NEW GAME' : 'PLAY')
    const btnCt  = this.menuButton(width / 2, height * (y + ROW), 'CONTROLS')
    const btnSnd = this.menuButton(width / 2, height * (y + ROW * 2), '')
    const { bestTimeSec, bestScore } = loadSettings()
    const records = [
      bestScore !== null ? `HIGH SCORE: ${formatScore(bestScore)}` : '',
      bestTimeSec !== null ? `BEST TIME: ${formatDuration(bestTimeSec)}` : '',
    ].filter(Boolean).join('\n')
    const bestTx = this.add.text(16, 16, records, {
      lineSpacing: 6,
      fontSize: '9px', fontFamily: FONT, color: CLR_TITLE, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0)
    const refreshSound = () => btnSnd.setText(SoundManager.isMuted() ? 'SOUND: OFF' : 'SOUND: ON')
    const toggleSound  = () => { setSoundMuted(!SoundManager.isMuted()); refreshSound() }
    refreshSound()
    btnSnd.on('pointerdown', toggleSound)
    onKeyPress(this, e => { if (e.code === 'KeyM') refreshSound() })  // M toggles sound globally (main.ts)

    const startGame = () => this.startGame()
    const continueGame = () => this.continueGame()
    const goControls = () => this.showScreen('controls')

    btnCont?.on('pointerdown', continueGame)
    btn1P.on('pointerdown',  startGame)
    btnCt.on('pointerdown',  goControls)

    const tip = this.add.text(width / 2, height - 28, '♦  Bluetooth controllers supported  ♦', {
      fontSize: '9px', fontFamily: FONT, color: CLR_DIM,
    }).setOrigin(0.5)

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const gpItems: MenuItem[] = [
      ...(btnCont ? [{ text: btnCont, action: continueGame }] : []),
      { text: btn1P,  action: startGame  },
      { text: btnCt,  action: goControls },
      { text: btnSnd, action: toggleSound },
    ]

    items.push(bestTx, btn1P, btnCt, btnSnd, tip)
    if (btnCont) items.push(btnCont)

    if (isLocalhost) {
      const goDevMenu = () => this.showScreen('devMenu')
      const btnDev = this.add.text(width - 40, 24, 'DEV', {
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
      ...row('MOVE',    'A D  /  ← →', 'Left Stick'),
      ...row('JUMP',    'W  /  ↑  /  SPACE', 'Cross  /  A'),
      ...row('FLOAT',   'Hold jump', 'Hold Cross'),
      ...row('SHIELD',  'C',       'Triangle  /  Y'),
      ...row('ABILITY', 'X',       'Circle  /  B'),
      ...row('MELEE',   'Z',       'Square  /  X'),
      ...row('DOORS',   'Jump',    'D-pad ↑'),
      ...row('TALK',    'X',       'Square  /  X'),
      ...row('PAUSE',   'ESC',     'Start'),
    ]
    y += 10

    const note = this.add.text(cx, y, 'Play with a keyboard, touch screen, or Bluetooth controller', {
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
    this.nav.setItems(group.getData('gpItems') as MenuItem[])
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
    resetRunState(this.registry)
    this.registry.set('runRooms',    rooms ?? generateRun())
    this.registry.set('runIndex',    index)
    this.registry.set('entryDir',    null)
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
  }

  /** Resumes the run saved in the browser, at the start of the room the player last entered. */
  private continueGame() {
    SoundManager.unlock()
    if (!loadSavedRun(this.registry)) { this.scene.restart(); return }
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private startGame() {
    SoundManager.unlock()
    resetRunState(this.registry)
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
  }
}
