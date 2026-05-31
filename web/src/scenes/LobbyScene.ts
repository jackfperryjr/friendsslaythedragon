import Phaser from 'phaser'
import { NetworkManager } from '../network/NetworkManager'

type LobbyScreen = 'main' | 'joining' | 'waiting'

const FONT   = '"Press Start 2P", monospace'
const YELLOW = '#ffe066'
const WHITE  = '#ffffff'
const DIM    = '#7799aa'
const CYAN   = '#40c4ff'
const RED    = '#ff4444'

// WebSocket server URL — override with VITE_WS_URL env var at build time
const WS_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WS_URL
  ?? `ws://${location.hostname}:8080`

export class LobbyScene extends Phaser.Scene {
  private nm!: NetworkManager
  private groups = new Map<LobbyScreen, Phaser.GameObjects.Container>()

  // Joining screen
  private codeEntry = ''
  private codeDisplay!: Phaser.GameObjects.Text
  private joinError!: Phaser.GameObjects.Text

  // Waiting screen
  private slotTexts: Phaser.GameObjects.Text[] = []
  private waitStatus!: Phaser.GameObjects.Text
  private startBtn!: Phaser.GameObjects.Text
  private leaveBtn!: Phaser.GameObjects.Text

  // Gamepad navigation
  private gpCursor!: Phaser.GameObjects.Text
  private activeItems: { text: Phaser.GameObjects.Text; action: () => void }[] = []
  private focusIdx = 0


  constructor() { super({ key: 'LobbyScene' }) }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, 0x080818)
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0030, 0.45)

    this.nm = new NetworkManager(WS_URL)

    this.gpCursor = this.add.text(0, 0, '►', {
      fontSize: '14px', fontFamily: FONT, color: YELLOW,
    }).setOrigin(1, 0.5).setDepth(20).setVisible(false)

    this.buildMain()
    this.buildJoining()
    this.buildWaiting()

    this.showScreen('main')
    this.setupGamepad()
    this.cameras.main.fadeIn(400, 0, 0, 0)
  }

  // ── screens ──────────────────────────────────────────────────────────────────

  private showScreen(s: LobbyScreen) {
    for (const [key, grp] of this.groups) grp.setVisible(key === s)
    const grp = this.groups.get(s)
    const gpItems = grp?.getData('gpItems') as { text: Phaser.GameObjects.Text; action: () => void }[] | undefined
    this.setActiveItems(gpItems ?? [])
  }

  private setupGamepad() {
    this.input.gamepad?.on(
      Phaser.Input.Gamepad.Events.BUTTON_DOWN,
      (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        if (button.index === 12) this.moveFocus(-1)
        if (button.index === 13) this.moveFocus(1)
        if (button.index === 0 || button.index === 9) this.activateFocus()
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
    const b = item.text.getBounds()
    this.gpCursor.setPosition(b.left - 10, b.centerY).setVisible(true)
  }

  private setActiveItems(items: { text: Phaser.GameObjects.Text; action: () => void }[]) {
    this.activeItems = items
    this.focusIdx = 0
    this.gpCursor.setVisible(false)
  }

  // ── main ─────────────────────────────────────────────────────────────────────

  private buildMain() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []

    items.push(this.add.text(width / 2, 44, 'ONLINE', {
      fontSize: '16px', fontFamily: FONT, color: YELLOW,
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5))

    items.push(this.add.text(width / 2, height * 0.26, 'Play with friends on\nany device or browser!', {
      fontSize: '10px', fontFamily: FONT, color: DIM, align: 'center',
    }).setOrigin(0.5))

    const btnCreate = this.menuBtn(width / 2, height * 0.44, 'CREATE ROOM')
    const btnJoin   = this.menuBtn(width / 2, height * 0.58, 'JOIN ROOM')
    const btnBack   = this.menuBtn(width / 2, height * 0.76, '< BACK')

    const errText = this.add.text(width / 2, height * 0.68, '', {
      fontSize: '9px', fontFamily: FONT, color: RED,
    }).setOrigin(0.5)

    btnCreate.on('pointerdown', async () => {
      btnCreate.setAlpha(0.5).disableInteractive()
      try {
        await this.nm.connect()
        this.setupNetworkCallbacks()
        this.nm.createRoom()
      } catch {
        btnCreate.setAlpha(1).setInteractive({ useHandCursor: true })
        errText.setText('Could not reach server\nMake sure server is running')
      }
    })

    btnJoin.on('pointerdown', () => {
      this.codeEntry = ''
      this.joinError.setText('')
      this.codeDisplay.setText('______')
      this.showScreen('joining')
    })

    btnBack.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'))
    })

    items.push(btnCreate, btnJoin, btnBack, errText)
    const mainContainer = this.add.container(0, 0, items)
    mainContainer.setData('gpItems', [
      { text: btnCreate, action: () => btnCreate.emit('pointerdown') },
      { text: btnJoin,   action: () => btnJoin.emit('pointerdown')   },
      { text: btnBack,   action: () => btnBack.emit('pointerdown')   },
    ])
    this.groups.set('main', mainContainer)
  }

  // ── joining ───────────────────────────────────────────────────────────────────

  private buildJoining() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []

    items.push(this.add.text(width / 2, 44, 'JOIN ROOM', {
      fontSize: '16px', fontFamily: FONT, color: YELLOW,
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5))

    items.push(this.add.rectangle(width / 2, height * 0.40, 340, 160, 0x111128).setStrokeStyle(1, 0x223355))

    items.push(this.add.text(width / 2, height * 0.28, 'Type the 6-character code:', {
      fontSize: '9px', fontFamily: FONT, color: DIM,
    }).setOrigin(0.5))

    items.push(this.add.text(width / 2, height * 0.28 + 22, '(tap code to open keyboard on mobile)', {
      fontSize: '7px', fontFamily: FONT, color: DIM,
    }).setOrigin(0.5))

    this.codeDisplay = this.add.text(width / 2, height * 0.40, '______', {
      fontSize: '36px', fontFamily: FONT, color: CYAN, letterSpacing: 18,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    items.push(this.codeDisplay)

    // Hidden HTML input for mobile virtual keyboard
    const mobileInput = document.createElement('input')
    mobileInput.type = 'text'
    mobileInput.setAttribute('inputmode', 'text')
    mobileInput.setAttribute('autocapitalize', 'characters')
    mobileInput.autocomplete = 'off'
    mobileInput.style.cssText = [
      'position:fixed', 'opacity:0', 'pointer-events:none',
      'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'width:1px', 'height:1px', 'font-size:16px',
    ].join(';')
    document.body.appendChild(mobileInput)

    // Tap code display → focus hidden input → native keyboard opens
    this.codeDisplay.on('pointerdown', () => {
      mobileInput.value = this.codeEntry
      mobileInput.focus()
    })

    mobileInput.addEventListener('input', () => {
      const val = mobileInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      this.codeEntry = val
      mobileInput.value = val
      this.codeDisplay.setText(val.padEnd(6, '_'))
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { mobileInput.remove() })

    this.joinError = this.add.text(width / 2, height * 0.54, '', {
      fontSize: '9px', fontFamily: FONT, color: RED,
    }).setOrigin(0.5)
    items.push(this.joinError)

    const btnJoin = this.menuBtn(width / 2, height * 0.65, 'JOIN')
    const btnBack = this.menuBtn(width / 2, height * 0.79, '< BACK')

    btnJoin.on('pointerdown', () => this.submitJoinCode(btnJoin))
    btnBack.on('pointerdown', () => {
      this.codeEntry = ''
      this.showScreen('main')
    })

    items.push(btnJoin, btnBack)

    const joiningGpItems = [
      { text: btnJoin, action: () => btnJoin.emit('pointerdown') },
      { text: btnBack, action: () => btnBack.emit('pointerdown') },
    ]

    // Keyboard capture for typing the room code
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.groups.get('joining')?.visible) return
      const key = event.key.toUpperCase()
      if (key === 'BACKSPACE') {
        this.codeEntry = this.codeEntry.slice(0, -1)
      } else if (key === 'ENTER') {
        this.submitJoinCode(btnJoin)
        return
      } else if (key.length === 1 && /[A-Z0-9]/.test(key) && this.codeEntry.length < 6) {
        this.codeEntry += key
      }
      const shown = this.codeEntry.padEnd(6, '_')
      this.codeDisplay.setText(shown)
    })

    const joiningContainer = this.add.container(0, 0, items)
    joiningContainer.setData('gpItems', joiningGpItems)
    this.groups.set('joining', joiningContainer)
  }

  private async submitJoinCode(btn: Phaser.GameObjects.Text) {
    if (this.codeEntry.length < 6) { this.joinError.setText('Please enter 6 characters'); return }
    btn.setAlpha(0.5).disableInteractive()
    this.joinError.setText('')
    try {
      await this.nm.connect()
      this.setupNetworkCallbacks()
      this.nm.joinRoom(this.codeEntry)
    } catch {
      btn.setAlpha(1).setInteractive({ useHandCursor: true })
      this.joinError.setText('Could not reach server\nMake sure server is running')
    }
  }

  // ── waiting ───────────────────────────────────────────────────────────────────

  private buildWaiting() {
    const { width, height } = this.scale
    const items: Phaser.GameObjects.GameObject[] = []

    items.push(this.add.text(width / 2, 44, 'WAITING FOR PLAYERS', {
      fontSize: '16px', fontFamily: FONT, color: YELLOW,
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5))

    // Room code card
    items.push(this.add.rectangle(width / 2, height * 0.27, 340, 120, 0x111128).setStrokeStyle(1, 0x223355))

    items.push(this.add.text(width / 2, height * 0.19, 'ROOM CODE', {
      fontSize: '9px', fontFamily: FONT, color: DIM,
    }).setOrigin(0.5))

    const codeLabel = this.add.text(width / 2, height * 0.27, '------', {
      fontSize: '32px', fontFamily: FONT, color: CYAN, letterSpacing: 14,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5)
    // will be updated by setupNetworkCallbacks
    ;(codeLabel as Phaser.GameObjects.Text & { _isCodeLabel: boolean })._isCodeLabel = true
    items.push(codeLabel)

    const copyBtn = this.add.text(width / 2, height * 0.35, '[ COPY CODE ]', {
      fontSize: '9px', fontFamily: FONT, color: CYAN,
      stroke: '#000', strokeThickness: 2,
      backgroundColor: '#00000044', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    copyBtn.on('pointerover', () => copyBtn.setColor('#ffffff'))
    copyBtn.on('pointerout',  () => copyBtn.setColor(CYAN))
    copyBtn.on('pointerdown', () => {
      const code = this.nm.roomCode
      if (!code) return
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.setText('[ COPIED! ]').setColor('#66ff88')
        this.time.delayedCall(1500, () => copyBtn.setText('[ COPY CODE ]').setColor(CYAN))
      }).catch(() => {
        copyBtn.setText('[ COPY FAILED ]').setColor(RED)
        this.time.delayedCall(1500, () => copyBtn.setText('[ COPY CODE ]').setColor(CYAN))
      })
    })
    items.push(copyBtn)

    // Player slots card
    items.push(this.add.rectangle(width / 2, height * 0.57, 340, 148, 0x111128).setStrokeStyle(1, 0x223355))

    items.push(this.add.text(width / 2, height * 0.44, 'PLAYERS', {
      fontSize: '9px', fontFamily: FONT, color: DIM,
    }).setOrigin(0.5))

    const PLAYER_COLORS = [WHITE, '#66aaff', '#66ff88', '#ff9933']
    const SLOT_LABELS = ['P1 — HOST', 'P2', 'P3', 'P4']
    this.slotTexts = []

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(width / 2, height * 0.50 + i * 30, SLOT_LABELS[i], {
        fontSize: '11px', fontFamily: FONT, color: PLAYER_COLORS[i],
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.3)
      this.slotTexts.push(t)
      items.push(t)
    }

    this.waitStatus = this.add.text(width / 2, height * 0.74, 'Waiting for players…', {
      fontSize: '9px', fontFamily: FONT, color: DIM,
    }).setOrigin(0.5)
    items.push(this.waitStatus)

    this.startBtn = this.menuBtn(width / 2, height * 0.84, '▶  START GAME')
    this.startBtn.setAlpha(0.3).disableInteractive()
    this.startBtn.on('pointerdown', () => this.nm.startGame())
    items.push(this.startBtn)

    this.leaveBtn = this.menuBtn(width / 2, height * 0.93, '< LEAVE')
    this.leaveBtn.on('pointerdown', () => {
      this.nm.disconnect()
      this.showScreen('main')
    })
    items.push(this.leaveBtn)

    const waitingContainer = this.add.container(0, 0, items)
    waitingContainer.setData('gpItems', [
      { text: this.leaveBtn, action: () => this.leaveBtn.emit('pointerdown') },
    ])
    this.groups.set('waiting', waitingContainer)
  }

  // ── network callbacks ────────────────────────────────────────────────────────

  private getCodeLabel(): Phaser.GameObjects.Text | undefined {
    const grp = this.groups.get('waiting')
    if (!grp) return undefined
    return grp.list.find(
      obj => (obj as Phaser.GameObjects.Text & { _isCodeLabel?: boolean })._isCodeLabel
    ) as Phaser.GameObjects.Text | undefined
  }

  private setupNetworkCallbacks() {
    this.nm.onRoomCreated = (code) => {
      const label = this.getCodeLabel()
      if (label) label.setText(code)
      this.refreshSlots()
      this.showScreen('waiting')
    }

    this.nm.onRoomJoined = (code, players) => {
      const label = this.getCodeLabel()
      if (label) label.setText(code)
      this.nm.connectedIds = new Set(players)
      this.refreshSlots()
      this.showScreen('waiting')
    }

    this.nm.onPlayerJoined = () => {
      this.refreshSlots()
    }

    this.nm.onPlayerLeft = () => {
      this.refreshSlots()
    }

    this.nm.onGameStart = (playerCount) => {
      const remotes = Array.from(this.nm.connectedIds).filter(id => id !== this.nm.playerId)
      this.registry.set('playerCount',   playerCount)
      this.registry.set('networkManager', this.nm)
      this.registry.set('localPlayerId',  this.nm.playerId)
      this.registry.set('remotePlayers',  remotes)
      this.registry.set('currentLevel',   1)
      this.registry.set('currentRoom',    1)
      this.registry.set('lives',          3)
      this.registry.set('score',          0)
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelectScene'))
    }

    this.nm.onError = (text) => {
      this.joinError.setText(text)
      this.showScreen('joining')
    }
  }

  private refreshSlots() {
    const count = this.nm.connectedIds.size
    for (let i = 0; i < 4; i++) {
      const filled = this.nm.connectedIds.has(i)
      const isMe   = i === this.nm.playerId
      const label  = ['P1 — HOST', 'P2', 'P3', 'P4'][i]
      this.slotTexts[i].setText(filled ? `${label}${isMe ? ' ◄ YOU' : ' ✓'}` : label)
      this.slotTexts[i].setAlpha(filled ? 1 : 0.3)
    }

    const startEnabled = this.nm.isHost && count >= 2
    if (this.nm.isHost) {
      if (startEnabled) {
        this.startBtn.setAlpha(1).setInteractive({ useHandCursor: true })
        this.waitStatus.setText('Host: press START when ready!')
      } else {
        this.startBtn.setAlpha(0.3).disableInteractive()
        this.waitStatus.setText('Waiting for at least 1 more player…')
      }
    } else {
      this.waitStatus.setText(`${count}/4 players — waiting for host to start…`)
    }

    const gpItems: { text: Phaser.GameObjects.Text; action: () => void }[] = []
    if (startEnabled) gpItems.push({ text: this.startBtn, action: () => this.startBtn.emit('pointerdown') })
    gpItems.push({ text: this.leaveBtn, action: () => this.leaveBtn.emit('pointerdown') })
    this.groups.get('waiting')?.setData('gpItems', gpItems)
    if (this.groups.get('waiting')?.visible) this.setActiveItems(gpItems)
  }

  // ── shared helpers ────────────────────────────────────────────────────────────

  private menuBtn(x: number, y: number, label: string) {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', fontFamily: FONT, color: WHITE,
      stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000044', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => btn.setColor(YELLOW))
    btn.on('pointerout',  () => btn.setColor(WHITE))
    return btn
  }

}
