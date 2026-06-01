import Phaser from 'phaser'
import { Player } from '../game/Player'
import { Enemy } from '../game/Enemy'
import { Boss } from '../game/Boss'
import { Destructible } from '../game/Destructible'
import { CarterDuplicate } from '../game/CarterDuplicate'
import { ConradArmyTruck } from '../game/ConradArmyTruck'
import { CocoShadow } from '../game/CocoShadow'
import { GameManager } from '../game/GameManager'
import { UIManager } from '../ui/UIManager'
import { TouchControls } from '../ui/TouchControls'
import { RoomConfig, ExitDir, generateRun, TOTAL_LETTER_BUGS, WORD_LIST_L1, WORD_LIST_L2 } from '../levels'
import { AbilityType, DamageType } from '../types'
import { ItemSpawn } from '../levels'
import { NetworkManager, RemoteInput } from '../network/NetworkManager'
import { SoundManager } from '../audio/SoundManager'

const FONT = '"Press Start 2P", monospace'
const SCORE_ENEMY = 200
const SCORE_DESTRUCT = 100

const KEYBOARD_CONFIGS: Record<string, string>[] = [
  { left: 'A',    right: 'D',     jump: 'W',  inhale: 'C',     ability: 'X', down: 'S'    },
  { left: 'LEFT', right: 'RIGHT', jump: 'UP', inhale: 'COMMA', ability: 'L', down: 'DOWN' },
]

const OPPOSITE: Record<ExitDir, ExitDir> = { left:'right', right:'left', top:'bottom', bottom:'top' }
const DOOR_H = 130   // pixel height of a left/right door opening
const DOOR_W = 120   // pixel width of a top/bottom door opening

function getEntryPos(dir: ExitDir, cfg: RoomConfig): { x: number; y: number } {
  if (cfg.entrySpawns?.[dir]) return cfg.entrySpawns[dir]!
  const W = cfg.worldWidth
  const ep = cfg.exitPositions ?? {}
  switch (dir) {
    case 'left':   return { x: cfg.spawnX ?? (cfg.isBossRoom ? Math.round(cfg.worldWidth / 2) : 1370), y: ep.left ?? 640 }
    case 'right':
      // Continuous world rooms re-enter near the boss portal (the traversal point)
      if (cfg.bossPortal && cfg.worldMap && !cfg.isBossRoom)
        return { x: cfg.bossPortal.x + 80, y: cfg.bossPortal.y }
      // Boss rooms: spawn 500px from the right wall so the right-edge exit isn't immediately triggered
      if (cfg.isBossRoom)
        return { x: W - 570, y: ep.right ?? 640 }
      return { x: W - 70, y: ep.right  ?? 640 }
    case 'top':    return { x: ep.top    ?? W / 2, y: 80  }
    case 'bottom': return { x: ep.bottom ?? W / 2, y: 640 }
  }
}

export class GameScene extends Phaser.Scene {
  private cfg!: RoomConfig
  private gm!: GameManager
  private ui!: UIManager

  private players: Player[] = []
  private enemies: Enemy[] = []
  private boss: Boss | null = null
  private enemyGroup!: Phaser.Physics.Arcade.Group
  private destructibles: Destructible[] = []
  private crates: Phaser.Physics.Arcade.Image[] = []
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group

  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private spikeBalls: Phaser.Physics.Arcade.Image[] = []
  private spikeFloorTiles: Phaser.Physics.Arcade.Image[] = []
  private cameraTarget!: Phaser.GameObjects.Rectangle
  private bgLayers: Phaser.GameObjects.TileSprite[] = []
  private throneLabel: Phaser.GameObjects.Text | null = null
  private throneX = 0
  private bossPortalPos: { x: number; y: number } | null = null
  private portalLabel: Phaser.GameObjects.Text | null = null
  private roomTransitioning = false
  private bossDefeated = false
  private bossRoomLeftWall: Phaser.GameObjects.TileSprite | null = null
  private bossRoomLeftBarrier: Phaser.GameObjects.Rectangle | null = null
  private bossRoomRightBarrier: Phaser.GameObjects.Rectangle | null = null
  private level2ExitPos:  { x: number; y: number } | null = null
  private backExitPos:    { x: number; y: number } | null = null
  private backPortalPos:    { x: number; y: number } | null = null
  private backPortalLbl:    Phaser.GameObjects.Text | null = null
  private hiddenPortalPos:  { x: number; y: number } | null = null
  private pauseItems: { text: Phaser.GameObjects.Text; action: () => void }[] = []
  private pauseFocusIdx = 0
  private pauseCursor: Phaser.GameObjects.Text | null = null
  private wordMenuObjects: Phaser.GameObjects.GameObject[] = []
  private wordMenuNav: { up: () => void; down: () => void; left?: () => void; right?: () => void; confirm: () => void } | null = null

  private collectibleSprites: (Phaser.GameObjects.Image | Phaser.GameObjects.Container)[] = []
  private celeryNpcX: number | null = null
  private shieldGraphics: Phaser.GameObjects.Graphics[] = []
  private tilemapLayers: Phaser.Tilemaps.TilemapLayer[] = []
  private carterDuplicates: CarterDuplicate[] = []
  private conradTrucks: ConradArmyTruck[] = []
  private cocoShadow: CocoShadow | null = null
  private cocoSpindashState: 'none' | 'windup' | 'dashing' | 'exit' = 'none'
  private cocoSpinTween: Phaser.Tweens.Tween | null = null
  private cocoDashHitDestructibles = new Set<Destructible>()
  private callumNumbers: { obj: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Text; emitter: Phaser.GameObjects.Particles.ParticleEmitter }[] = []

  private dadNpcSprite:   Phaser.GameObjects.Image | null = null
  private dadCageGfx:     Phaser.GameObjects.Graphics | null = null
  private dadCageBubble:  Phaser.GameObjects.Container | null = null
  private dadHintBubble:  Phaser.GameObjects.Container | null = null
  private momNpcSprite:   Phaser.GameObjects.Image | null = null
  private momCageGfx:     Phaser.GameObjects.Graphics | null = null
  private momCageBubble:  Phaser.GameObjects.Container | null = null
  private momHintBubble:  Phaser.GameObjects.Container | null = null

  private playerKeysets = new Map<number, Record<string, Phaser.Input.Keyboard.Key>>()
  private touchControls: TouchControls | null = null
  private pauseContainer!: Phaser.GameObjects.Container
  private score = 0
  private _lastPadConnected = false
  private _debugLogTimer = 0

  private nm: NetworkManager | null = null
  private localPlayerId = 0
  private remoteInputs = new Map<number, RemoteInput>()

  constructor() { super({ key: 'GameScene' }) }

  init() {
    this.players = []; this.enemies = []; this.destructibles = []
    this.crates = []; this.bgLayers = []; this.collectibleSprites = []; this.celeryNpcX = null; this.shieldGraphics = []; this.carterDuplicates = []; this.conradTrucks = []; this.cocoShadow = null; this.callumNumbers = []; this.wordMenuObjects = []; this.wordMenuNav = null
    this.cocoSpindashState = 'none'; this.cocoSpinTween = null; this.cocoDashHitDestructibles = new Set()
    this.dadHintBubble = null; this.momHintBubble = null
    this.tilemapLayers = []; this.spikeBalls = []; this.spikeFloorTiles = []
    this.playerKeysets.clear(); this.touchControls = null
    this.remoteInputs.clear()
    this.nm = null
    this.score = 0
    this.boss = null
    this.throneLabel = null
    this.throneX = 0
    this.bossPortalPos = null
    this.portalLabel = null
    this.roomTransitioning = false
    this.bossDefeated = false
    this.bossRoomLeftWall = null
    this.bossRoomLeftBarrier = null
    this.bossRoomRightBarrier = null
    this.level2ExitPos = null
    this.backExitPos   = null
    this.backPortalPos   = null
    this.backPortalLbl   = null
    this.hiddenPortalPos = null
    this.pauseItems = []
    this.pauseFocusIdx = 0
    this.pauseCursor = null
    this._lastPadConnected = false
    this._debugLogTimer = 0
    this.dadNpcSprite  = null
    this.dadCageGfx    = null
    this.dadCageBubble = null
    this.momNpcSprite  = null
    this.momCageGfx    = null
    this.momCageBubble = null
  }

  create() {
    // ── Load or generate this run's room sequence ──────────────────────────────
    let runRooms: RoomConfig[] = this.registry.get('runRooms')
    if (!runRooms || runRooms.length === 0) {
      runRooms = generateRun()
      this.registry.set('runRooms', runRooms)
      this.registry.set('runIndex', 0)
      this.registry.set('entryDir', null)
    }
    const runIndex: number = this.registry.get('runIndex') ?? 0
    this.cfg = runRooms[runIndex]

    // If we entered via a direction, guarantee the return exit exists so the
    // player can always backtrack the way they came.
    const entryDir0: ExitDir | null = this.registry.get('entryDir') ?? null
    if (entryDir0 && !this.cfg.exits.includes(entryDir0)) {
      this.cfg = { ...this.cfg, exits: [...this.cfg.exits, entryDir0] }
    }

    this.score = this.registry.get('score') ?? 0
    if (!this.registry.get('runStartTime')) this.registry.set('runStartTime', Date.now())
    this.gm = new GameManager()

    this.nm = this.registry.get('networkManager') ?? null
    this.localPlayerId = this.registry.get('localPlayerId') ?? 0
    if (this.nm) {
      this.nm.onRemoteInput = (id, input) => this.remoteInputs.set(id, input)
      this.nm.onPlayerLeft  = (id) => this.removeRemotePlayer(id)
    }

    const W = this.cfg.worldWidth
    const H = this.cfg.worldHeight ?? 720
    this.physics.world.setBounds(-100, -100, W + 200, H + 200)
    this.cameras.main.setBounds(0, 0, W, H)
    this.cameras.main.setRoundPixels(true)

    this.buildBackground()
    this.buildScenery()
    this.initLevelWords()
    this.buildLevel()
    this.setupCollectibles()
    this.spawnPlayers()
    this.setupCollision()
    this.setupGamepadEvents()
    this.setupCamera()

    const _bossAlreadyDefeated = !!(this.cfg.bossDefeatedKey && this.registry.get(this.cfg.bossDefeatedKey))
    this.ui = new UIManager(
      this,
      this.registry.get('playerCount') ?? 1,
      this.cfg.name,
      (this.cfg.isBossRoom ?? false) && !_bossAlreadyDefeated,
      this.cfg.bossHp ?? 0,
      this.cfg.bossName ?? 'BOSS',
    )

    if (this.boss) {
      this.boss.on('hpChanged', (hp: number, max: number) => this.ui.updateBossBar(hp, max))
      if (!this.cfg.bossNoAttack) this.boss.on('bossAttack', (ability: AbilityType) => this.fireBossSpecial(ability))
      this.ui.updateBossBar(this.cfg.bossHp!, this.cfg.bossHp!)
    }

    this.wirePlayerUIEvents()
    this.ui.updateLetters(this.registry.get('collectedLetters') ?? [])
    this.buildNPCs()
    this.buildTorches()
    this.buildPauseMenu()
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause())
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const defeatedKey = this.cfg.bossDefeatedKey
    const isBossRoomLive = this.cfg.isBossRoom && !(defeatedKey && this.registry.get(defeatedKey))
    const trackKey = isBossRoomLive
      ? (this.cfg.bossMusicKey ?? 'music-boss')
      : (this.cfg.musicKey    ?? 'music-gameplay')
    SoundManager.startTrack(this.sound, trackKey)
  }

  // ── background ──────────────────────────────────────────────────────────────

  private doorGlow(x: number, y: number, w: number, h: number) {
    const g = this.add.graphics().setDepth(-1)
    const color = 0x00e5ff
    // Gradient radiating from door: bright at opening, fading outward
    for (let i = 9; i >= 0; i--) {
      const t   = i / 9              // 1=outermost, 0=at door
      const exp = t * 48
      g.fillStyle(color, (1 - t) * 0.26 + 0.02)
      g.fillRect(x - exp, y - exp, w + exp * 2, h + exp * 2)
    }
    g.lineStyle(2, color, 0.90)
    g.strokeRect(x, y, w, h)
    g.lineStyle(3, color, 1)
    if (w < h) {
      g.beginPath(); g.moveTo(x - 5, y);     g.lineTo(x + w + 5, y);     g.strokePath()
      g.beginPath(); g.moveTo(x - 5, y + h); g.lineTo(x + w + 5, y + h); g.strokePath()
    } else {
      g.beginPath(); g.moveTo(x,     y - 5); g.lineTo(x,     y + h + 5); g.strokePath()
      g.beginPath(); g.moveTo(x + w, y - 5); g.lineTo(x + w, y + h + 5); g.strokePath()
    }
    this.tweens.add({ targets: g, alpha: { from: 0.65, to: 1 }, duration: 1200, yoyo: true, repeat: -1 })
  }

  private buildBackground() {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2
    const W = this.cfg.worldWidth

    if (this.cfg.worldMap && !this.cfg.isOutdoor) return  // tilemap layers serve as background

    // Outdoor rooms: twilight/after-sunset atmospheric gradient + stars + clouds
    if (this.cfg.isOutdoor) {
      // depth -1: sits above the tilemap 'Sky' background layer (-2) but below solid tiles (1)
      const g = this.add.graphics().setScrollFactor(0).setDepth(-1)
      g.fillGradientStyle(
        0x06020f, 0x06020f,   // top: near-black deep night
        0x1a0838, 0x1a0838,   // bottom: deep purple dusk horizon
        1.0, 1.0,
        1.0, 1.0
      )
      g.fillRect(0, 0, width, height)

      // Stars — two layers that twinkle at different rates (depth -1, drawn after gradient)
      const makeStarLayer = (seed: number, count: number) => {
        const sg = this.add.graphics().setScrollFactor(0).setDepth(-1)
        let n = seed
        const rng = () => { n = (n * 1664525 + 1013904223) & 0x7fffffff; return n / 0x7fffffff }
        for (let i = 0; i < count; i++) {
          const sx  = rng() * width
          const sy  = rng() * height * 0.70
          const big = rng() > 0.88
          const r   = rng()
          const col = r > 0.65 ? 0xdde0ff : r > 0.35 ? 0xffffc8 : 0xffffff
          sg.fillStyle(col, big ? 0.95 : 0.80)
          if (big) sg.fillRect(sx - 0.5, sy - 0.5, 2, 2)
          else     sg.fillRect(sx, sy, 1, 1)
        }
        return sg
      }
      const stars1 = makeStarLayer(42,  75)
      const stars2 = makeStarLayer(137, 55)
      this.tweens.add({ targets: stars1, alpha: 0.20, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      this.tweens.add({ targets: stars2, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1, delay: 700, ease: 'Sine.InOut' })

      // Clouds — barely-visible lavender, just slightly lighter than the sky
      const cloudG = this.add.graphics().setScrollFactor(0).setDepth(-1)
      const drawCloud = (clx: number, cly: number, wr: number, hr: number) => {
        cloudG.fillStyle(0x4a3272, 0.38)
        cloudG.fillEllipse(clx, cly, wr, hr)
        cloudG.fillEllipse(clx - wr * 0.28, cly + hr * 0.18, wr * 0.55, hr * 0.65)
        cloudG.fillEllipse(clx + wr * 0.28, cly + hr * 0.18, wr * 0.55, hr * 0.65)
      }
      drawCloud(width * 0.10, height * 0.42, 210, 72)
      drawCloud(width * 0.38, height * 0.28, 170, 58)
      drawCloud(width * 0.63, height * 0.48, 230, 78)
      drawCloud(width * 0.85, height * 0.35, 150, 52)
      this.tweens.add({ targets: cloudG, alpha: 0.30, duration: 4500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

      return
    }

    // Dark rooms (levels 5-7+): purple overlay on top of tilemap background
    if (this.cfg.isDark && !this.cfg.isBossRoom) {
      this.add.rectangle(cx, cy, width, height, 0x08001a, 0.42).setScrollFactor(0).setDepth(1)
    }

    if (this.cfg.roomImage) {
      this.add.image(W / 2, 360, this.cfg.roomImage)
        .setDisplaySize(W, 720).setDepth(-2)
      this.bgLayers.push(
        this.add.tileSprite(cx, cy, width, height, this.cfg.bgMid)
          .setScrollFactor(0).setAlpha(0.20),
      )
      return
    }

    this.bgLayers.push(
      this.add.tileSprite(cx, cy, width, height, this.cfg.bgFar).setScrollFactor(0),
      this.add.tileSprite(cx, cy, width, height, this.cfg.bgMid)
        .setScrollFactor(0).setAlpha(0.75),
    )

    if (this.cfg.isBossRoom) {
      const overlay = this.add.rectangle(cx, cy, width, height, 0x00001a, 0.40).setScrollFactor(0).setDepth(1)
      this.tweens.add({ targets: overlay, alpha: 0.55, duration: 2000, yoyo: true, repeat: -1 })
    } else if (this.cfg.isThrone) {
      this.add.rectangle(cx, cy, width, height, 0x0a0a2a, 0.45).setScrollFactor(0).setDepth(1)
    }
  }

  // ── scenery ──────────────────────────────────────────────────────────────────

  private buildScenery() {
    const w = this.cfg.worldWidth
    if (this.cfg.worldMap)  { return }
    if (this.cfg.roomImage) { return }
    if (this.cfg.isBossRoom) { this.buildSceneryThrone(w); return }
    if (this.cfg.isThrone)   { this.buildSceneryThrone(w); return }
    if (this.cfg.isTutorial) { this.buildSceneryHall(w);   return }
    const hash = this.cfg.name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    switch (hash % 5) {
      case 0: this.buildSceneryHall(w);    break
      case 1: this.buildSceneryDungeon(w); break
      case 2: this.buildSceneryCrypt(w);   break
      case 3: this.buildSceneryChapel(w);  break
      default: this.buildSceneryArmory(w); break
    }
  }

  // ── Outside — sky, sea horizon, clouds, grassy terrain ───────────────────────
  // ── Great Hall — warm stone, pillars, torches, hanging banners ────────────────
  private buildSceneryHall(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x0f0800, 0.30).setDepth(2)

    // Stone pillars
    const pillars = Math.max(3, Math.floor(w / 280))
    for (let i = 0; i < pillars; i++) {
      const px = 160 + i * (w / pillars)
      this.add.rectangle(px, 360, 28, 720, 0x1a1208, 0.85).setDepth(3)
      this.add.rectangle(px, 360, 22, 720, 0x221a0e, 0.6).setDepth(3)
      this.add.rectangle(px, 14,  44, 14, 0x2a2010, 0.9).setDepth(4)
      this.add.rectangle(px, 686, 44, 14, 0x2a2010, 0.9).setDepth(4)
    }

    // Wall torches
    const torches = Math.max(2, Math.floor(w / 360))
    for (let i = 0; i < torches; i++) {
      const tx = 200 + i * (w / torches)
      this.add.rectangle(tx, 200, 8, 30, 0x4a3820, 0.9).setDepth(4)
      this.add.rectangle(tx, 185, 12, 8, 0x5a4828, 0.9).setDepth(4)
      const flame = this.add.rectangle(tx, 176, 16, 20, 0xff8800, 0.85).setDepth(5)
      const glow  = this.add.rectangle(tx, 176, 48, 80, 0xff6600, 0.10).setDepth(4)
      this.tweens.add({ targets: flame, scaleY: 0.7, scaleX: 0.8, alpha: 0.6, duration: 150 + (tx % 120), yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.04, duration: 200 + (tx % 150), yoyo: true, repeat: -1 })
    }

    // Hanging banners
    const banners = Math.max(2, Math.floor(w / 400))
    for (let i = 0; i < banners; i++) {
      const bx = 220 + i * (w / banners)
      this.add.rectangle(bx, 120, 36, 180, 0x4a0808, 0.85).setDepth(3)
      this.add.rectangle(bx, 120, 12, 180, 0x660a0a, 0.6).setDepth(3)
      this.add.rectangle(bx,  90, 36, 10, 0xcc8800, 0.7).setDepth(4)
      this.add.rectangle(bx, 210, 36, 10, 0xcc8800, 0.7).setDepth(4)
    }

    // Floor flagstones
    const tiles = Math.ceil(w / 80)
    for (let i = 0; i < tiles; i++) {
      if (i % 2 === 0) this.add.rectangle(40 + i * 80, 686, 78, 28, 0x1a1208, 0.4).setDepth(2)
    }

    // Ceiling arches between pillars
    for (let i = 0; i < pillars - 1; i++) {
      const ax = 160 + i * (w / pillars) + (w / pillars) / 2
      this.add.rectangle(ax, 12, w / pillars - 30, 18, 0x221a0e, 0.7).setDepth(3)
    }
  }

  // ── Dungeon — chains, iron bars, dripping water, skull motifs ────────────────
  private buildSceneryDungeon(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x040408, 0.38).setDepth(2)

    // Ceiling chains
    const chains = Math.ceil(w / 220)
    for (let i = 0; i < chains; i++) {
      const cx = 110 + i * 220 + (i % 3 - 1) * 20
      const ch = 60 + (i % 4) * 28
      for (let j = 0; j < Math.floor(ch / 8); j++) {
        this.add.rectangle(cx + (j % 2 === 0 ? 0 : 2), 8 + j * 8, j % 2 === 0 ? 5 : 7, 7, 0x3a3a3a, 0.9).setDepth(3)
      }
      this.add.rectangle(cx, 10 + ch, 12, 8, 0x4a4a4a, 0.9).setDepth(4)
    }

    // Iron bar sections
    const barGroups = Math.max(2, Math.floor(w / 480))
    for (let i = 0; i < barGroups; i++) {
      const bgx = 240 + i * (w / barGroups)
      const bgy = 420
      this.add.rectangle(bgx, bgy, 120, 160, 0x1a1a1a, 0.7).setDepth(2)
      for (let b = 0; b < 5; b++) {
        this.add.rectangle(bgx - 48 + b * 24, bgy, 6, 154, 0x333333, 0.9).setDepth(3)
      }
      this.add.rectangle(bgx, bgy, 120, 6, 0x3d3d3d, 0.9).setDepth(4)
    }

    // Skull carvings
    const skulls = Math.max(2, Math.floor(w / 420))
    for (let i = 0; i < skulls; i++) {
      const sx = 180 + i * (w / skulls)
      const sy = 270 + (i % 2) * 60
      this.add.circle(sx, sy, 14, 0x221a0a, 0.9).setDepth(3)
      this.add.rectangle(sx - 5, sy - 2, 5, 5, 0x0a0a0a, 0.95).setDepth(4)
      this.add.rectangle(sx + 5, sy - 2, 5, 5, 0x0a0a0a, 0.95).setDepth(4)
    }

    // Floor puddles
    const puddles = Math.max(2, Math.floor(w / 380))
    for (let i = 0; i < puddles; i++) {
      const px = 160 + i * (w / puddles) + (i % 3 - 1) * 30
      const pool = this.add.rectangle(px, 686, 60 + (i % 3) * 20, 4, 0x334455, 0.35).setDepth(2)
      this.tweens.add({ targets: pool, alpha: 0.15, duration: 1400 + (px % 600), yoyo: true, repeat: -1 })
    }

    // Dim torches
    const dTorches = Math.max(2, Math.floor(w / 480))
    for (let i = 0; i < dTorches; i++) {
      const tx = 240 + i * (w / dTorches)
      this.add.rectangle(tx, 240, 7, 24, 0x3a2810, 0.9).setDepth(4)
      const flame = this.add.rectangle(tx, 228, 12, 16, 0xff6600, 0.65).setDepth(5)
      const glow  = this.add.rectangle(tx, 228, 40, 60, 0xff4400, 0.06).setDepth(4)
      this.tweens.add({ targets: flame, scaleY: 0.6, alpha: 0.45, duration: 180 + (tx % 100), yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.02, duration: 220 + (tx % 120), yoyo: true, repeat: -1 })
    }
  }

  // ── Crypt — stone arches, coffin alcoves, candles, rune carvings ──────────────
  private buildSceneryCrypt(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x060408, 0.35).setDepth(2)

    // Ceiling arch ribs
    const arches = Math.max(3, Math.floor(w / 300))
    for (let i = 0; i < arches; i++) {
      const ax = 150 + i * (w / arches)
      this.add.rectangle(ax, 8, 16, 28, 0x1a1218, 0.9).setDepth(3)
      this.add.rectangle(ax - 60, 28, 8, 14, 0x1a1218, 0.7).setDepth(3)
      this.add.rectangle(ax + 60, 28, 8, 14, 0x1a1218, 0.7).setDepth(3)
    }

    // Coffin alcoves
    const alcoves = Math.max(2, Math.floor(w / 400))
    for (let i = 0; i < alcoves; i++) {
      const alx = 200 + i * (w / alcoves)
      const aly = 380
      this.add.rectangle(alx, aly, 72, 130, 0x0d0a10, 0.9).setDepth(2)
      this.add.rectangle(alx, aly - 64, 72, 4, 0x1a1520, 0.7).setDepth(3)
      this.add.rectangle(alx - 34, aly, 4, 124, 0x221a28, 0.7).setDepth(3)
      this.add.rectangle(alx + 34, aly, 4, 124, 0x221a28, 0.7).setDepth(3)
      this.add.rectangle(alx, aly + 30, 40, 8, 0x2a2230, 0.8).setDepth(3)
    }

    // Candles on floor
    const candles = Math.max(3, Math.floor(w / 260))
    for (let i = 0; i < candles; i++) {
      const cx = 130 + i * (w / candles) + (i % 3 - 1) * 15
      this.add.rectangle(cx, 670, 6, 24, 0xe8e0d0, 0.9).setDepth(4)
      const flame = this.add.rectangle(cx, 654, 6, 12, 0xffdd88, 0.9).setDepth(5)
      const glow  = this.add.rectangle(cx, 654, 24, 40, 0xffaa44, 0.10).setDepth(4)
      this.tweens.add({ targets: flame, scaleX: 0.6, scaleY: 0.8, alpha: 0.65, duration: 100 + (cx % 80), yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.04, duration: 130 + (cx % 100), yoyo: true, repeat: -1 })
    }

    // Rune strips on walls
    const runes = Math.max(3, Math.floor(w / 300))
    for (let i = 0; i < runes; i++) {
      const rx = 120 + i * (w / runes)
      const ry = 160 + (i % 4) * 50
      this.add.rectangle(rx, ry, 80, 2, 0x4a3858, 0.45).setDepth(2)
      this.add.rectangle(rx + 30, ry + 6, 20, 2, 0x3a2848, 0.35).setDepth(2)
    }
  }

  // ── Chapel — stained glass, pews, altar, gothic arches ───────────────────────
  private buildSceneryChapel(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x020408, 0.32).setDepth(2)

    // Stained glass windows
    const windows = Math.max(2, Math.floor(w / 380))
    const glassColors = [0x880033, 0x005588, 0x446600, 0x882200]
    for (let i = 0; i < windows; i++) {
      const wx = 190 + i * (w / windows)
      this.add.rectangle(wx, 220, 64, 140, 0x0d1020, 0.9).setDepth(2)
      this.add.rectangle(wx, 220, 58, 134, 0x101420, 0.8).setDepth(2)
      for (let p = 0; p < 4; p++) {
        const py = 220 - 42 + p * 28
        const pane = this.add.rectangle(wx, py, 52, 26, glassColors[p], 0.45).setDepth(3)
        this.tweens.add({ targets: pane, alpha: 0.25, duration: 2000 + p * 400 + (wx % 600), yoyo: true, repeat: -1 })
      }
      this.add.rectangle(wx, 220, 58, 4, 0x1a1e28, 0.9).setDepth(4)
      this.add.rectangle(wx, 220, 4, 134, 0x1a1e28, 0.9).setDepth(4)
      const pool = this.add.rectangle(wx, 680, 80, 6, glassColors[1], 0.15).setDepth(2)
      this.tweens.add({ targets: pool, alpha: 0.05, duration: 1800 + (wx % 600), yoyo: true, repeat: -1 })
    }

    // Pew silhouettes
    const pews = Math.max(3, Math.floor(w / 280))
    for (let i = 0; i < pews; i++) {
      const pewx = 140 + i * (w / pews) + (i % 2) * 30 - 15
      this.add.rectangle(pewx, 665, 160, 12, 0x180e06, 0.9).setDepth(3)
      this.add.rectangle(pewx, 655, 160, 4, 0x201408, 0.8).setDepth(3)
      this.add.rectangle(pewx - 72, 660, 8, 16, 0x180e06, 0.9).setDepth(3)
      this.add.rectangle(pewx + 72, 660, 8, 16, 0x180e06, 0.9).setDepth(3)
    }

    // Altar (small rooms only)
    if (w <= 1300) {
      const ax = w / 2
      this.add.rectangle(ax, 650, 120, 50, 0x1c1408, 0.9).setDepth(4)
      this.add.rectangle(ax, 625, 100, 6, 0x2a1e0e, 0.9).setDepth(4)
      ;[-30, 0, 30].forEach(ox => {
        this.add.rectangle(ax + ox, 616, 6, 18, 0xe8e0d0, 0.9).setDepth(5)
        const f = this.add.rectangle(ax + ox, 607, 5, 10, 0xffdd88, 0.85).setDepth(6)
        this.tweens.add({ targets: f, scaleX: 0.5, scaleY: 0.75, duration: 90 + Math.abs(ox), yoyo: true, repeat: -1 })
      })
    }

    // Gothic ceiling ribs
    const ribs = Math.max(3, Math.ceil(w / 200))
    for (let i = 0; i < ribs; i++) {
      this.add.rectangle(100 + i * (w / ribs), 10, 12, 24, 0x141018, 0.85).setDepth(3)
    }
  }

  // ── Armory — weapon racks, shields, flagstones, braziers ─────────────────────
  private buildSceneryArmory(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x0a0400, 0.32).setDepth(2)

    // Weapon racks
    const racks = Math.max(2, Math.floor(w / 380))
    for (let i = 0; i < racks; i++) {
      const rx = 180 + i * (w / racks)
      this.add.rectangle(rx, 360, 120, 8, 0x2a1a0a, 0.9).setDepth(3)
      for (let s = 0; s < 3; s++) {
        const sx = rx - 40 + s * 40
        this.add.rectangle(sx, 390, 5, 60, 0x505050, 0.85).setDepth(4)
        this.add.rectangle(sx, 368, 18, 5, 0x604030, 0.9).setDepth(4)
        this.add.rectangle(sx, 354, 5, 14, 0x7a5a3a, 0.9).setDepth(4)
      }
    }

    // Shield emblems
    const shields = Math.max(2, Math.floor(w / 460))
    for (let i = 0; i < shields; i++) {
      const shx = 200 + i * (w / shields)
      const shy = 240 + (i % 2) * 60
      this.add.rectangle(shx, shy, 48, 58, 0x1a0e06, 0.9).setDepth(2)
      this.add.rectangle(shx, shy + 8, 44, 44, 0x8b0000, 0.6).setDepth(3)
      this.add.rectangle(shx, shy + 8, 44, 6, 0xcc8800, 0.7).setDepth(4)
      this.add.rectangle(shx, shy + 8, 6, 44, 0xcc8800, 0.7).setDepth(4)
    }

    // Flagstone floor
    const stones = Math.ceil(w / 100)
    for (let i = 0; i < stones; i++) {
      this.add.rectangle(50 + i * 100, 686, 98, 28, i % 2 === 0 ? 0x141006 : 0x0e0c04, 0.5).setDepth(2)
    }

    // Ceiling braziers
    const braziers = Math.max(2, Math.floor(w / 340))
    for (let i = 0; i < braziers; i++) {
      const bx = 170 + i * (w / braziers)
      this.add.rectangle(bx, 20, 4, 30, 0x3a2810, 0.9).setDepth(3)
      this.add.rectangle(bx, 38, 20, 8, 0x4a3018, 0.9).setDepth(4)
      const flame = this.add.rectangle(bx, 26, 18, 20, 0xff8800, 0.8).setDepth(5)
      const glow  = this.add.rectangle(bx, 26, 50, 70, 0xff6600, 0.08).setDepth(4)
      this.tweens.add({ targets: flame, scaleY: 0.65, scaleX: 0.75, alpha: 0.55, duration: 140 + (bx % 120), yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.03, duration: 200 + (bx % 150), yoyo: true, repeat: -1 })
    }

    // Trophy mounts
    const trophies = Math.max(2, Math.floor(w / 500))
    for (let i = 0; i < trophies; i++) {
      const tx = 250 + i * (w / trophies)
      this.add.circle(tx, 300, 22, 0x1a0e06, 0.85).setDepth(3)
      this.add.circle(tx, 290, 16, 0x221408, 0.8).setDepth(3)
      this.add.rectangle(tx - 20, 272, 4, 22, 0x1a0e06, 0.8).setDepth(3).setRotation(-0.3)
      this.add.rectangle(tx + 20, 272, 4, 22, 0x1a0e06, 0.8).setDepth(3).setRotation(0.3)
    }
  }

  // ── Dark-level torches ────────────────────────────────────────────────────────
  private buildTorches() {
    if (!this.cfg.isDark || this.cfg.isBossRoom) return
    const W = this.cfg.worldWidth
    const H = this.cfg.worldHeight ?? 1856

    // Three height bands; first band nudged up 35px
    const bands = [H * 0.14 - 35, H * 0.44, H * 0.74]
    let idx = 0
    for (let x = 220; x < W - 100; x += 480) {
      this.spawnTorch(x, bands[idx % bands.length], idx * 180)
      idx++
    }
  }

  private spawnTorch(x: number, y: number, flickerOffset: number) {
    // Gradient glow — concentric rings, additive blend, single object for flicker
    const glow = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
    glow.fillStyle(0x441400, 0.22); glow.fillCircle(x, y - 8, 56)
    glow.fillStyle(0xff4400, 0.18); glow.fillCircle(x, y - 8, 42)
    glow.fillStyle(0xff8800, 0.22); glow.fillCircle(x, y - 8, 30)
    glow.fillStyle(0xffcc44, 0.28); glow.fillCircle(x, y - 8, 18)
    glow.fillStyle(0xffffff, 0.20); glow.fillCircle(x, y - 8, 8)

    // Torch bracket + handle (static)
    const body = this.add.graphics().setDepth(2)
    body.fillStyle(0x4a3420, 1); body.fillRect(x - 2, y, 4, 14)
    body.fillStyle(0x6a4e30, 1); body.fillRect(x - 5, y - 5, 10, 6)

    // Flame — static, no tween
    const flame = this.add.graphics().setDepth(3)
    flame.fillStyle(0xff8800, 0.90); flame.fillEllipse(x, y - 13, 9, 13)
    flame.fillStyle(0xffee44, 0.85); flame.fillEllipse(x, y - 17, 5, 8)
    flame.fillStyle(0xffffff, 0.55); flame.fillEllipse(x, y - 20, 3, 5)

    // Only the glow flickers
    this.tweens.add({
      targets: glow,
      alpha: 0.42,
      duration: 130 + (flickerOffset % 80),
      yoyo: true, repeat: -1, delay: flickerOffset % 350, ease: 'Sine.InOut',
    })
  }

  // ── Throne Hall — grand pillars, royal banners, ornate floor, throne ──────────
  private buildSceneryThrone(w: number) {
    this.buildWallFeatures(w)
    this.add.rectangle(w / 2, 360, w, 720, 0x0a0408, 0.38).setDepth(2)

    // Grand pillars
    const pillars = Math.max(4, Math.floor(w / 220))
    for (let i = 0; i < pillars; i++) {
      const px = 110 + i * (w / pillars)
      this.add.rectangle(px, 360, 32, 720, 0x15100c, 0.9).setDepth(3)
      this.add.rectangle(px, 360, 24, 720, 0x1e1810, 0.6).setDepth(3)
      this.add.rectangle(px, 12,  52, 18, 0x2a2016, 0.9).setDepth(4)
      this.add.rectangle(px, 682, 52, 18, 0x2a2016, 0.9).setDepth(4)
      this.add.rectangle(px, 40,  34, 4, 0xcc8800, 0.65).setDepth(4)
      this.add.rectangle(px, 672, 34, 4, 0xcc8800, 0.65).setDepth(4)
    }

    // Royal banners — purple/gold
    const banners = Math.max(3, Math.floor(w / 320))
    for (let i = 0; i < banners; i++) {
      const bx = 180 + i * (w / banners)
      this.add.rectangle(bx, 140, 48, 220, 0x380848, 0.9).setDepth(3)
      this.add.rectangle(bx, 140, 36, 220, 0x440a58, 0.5).setDepth(3)
      this.add.rectangle(bx,  30, 48, 8, 0xcc8800, 0.8).setDepth(4)
      this.add.rectangle(bx, 250, 48, 8, 0xcc8800, 0.8).setDepth(4)
      this.add.rectangle(bx, 140, 16, 16, 0xcc8800, 0.6).setDepth(4).setRotation(Math.PI / 4)
    }

    // Ornate floor tiles
    const tiles = Math.ceil(w / 64)
    for (let i = 0; i < tiles; i++) {
      this.add.rectangle(32 + i * 64, 686, 62, 28, i % 2 === 0 ? 0x1a1408 : 0x120e06, 0.6).setDepth(2)
      if (i % 4 === 0) this.add.rectangle(32 + i * 64, 686, 2, 28, 0xcc8800, 0.2).setDepth(3)
    }

    // Throne dais
    const tx = w / 2
    this.add.rectangle(tx, 654, 100, 48, 0x1a1008, 0.95).setDepth(4)
    this.add.rectangle(tx, 590, 90, 140, 0x1e1408, 0.95).setDepth(4)
    this.add.rectangle(tx, 590, 80, 130, 0x280c08, 0.7).setDepth(4)
    this.add.rectangle(tx - 44, 630, 14, 50, 0x1a1008, 0.9).setDepth(4)
    this.add.rectangle(tx + 44, 630, 14, 50, 0x1a1008, 0.9).setDepth(4)
    this.add.rectangle(tx, 518, 90, 8, 0xcc8800, 0.7).setDepth(5)
    for (let pt = 0; pt < 5; pt++) {
      this.add.rectangle(tx - 36 + pt * 18, 510, 8, 16, 0xcc8800, 0.65).setDepth(5)
    }

    // Grand torches
    const tTorches = Math.max(3, Math.floor(w / 280))
    for (let i = 0; i < tTorches; i++) {
      const torchX = 140 + i * (w / tTorches)
      this.add.rectangle(torchX, 180, 10, 40, 0x4a3820, 0.9).setDepth(4)
      this.add.rectangle(torchX, 162, 16, 10, 0x604828, 0.9).setDepth(4)
      const flame = this.add.rectangle(torchX, 150, 22, 28, 0xff9900, 0.9).setDepth(5)
      const glow  = this.add.rectangle(torchX, 150, 70, 120, 0xff7700, 0.10).setDepth(4)
      this.tweens.add({ targets: flame, scaleY: 0.65, scaleX: 0.7, alpha: 0.65, duration: 120 + (torchX % 110), yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.04, duration: 180 + (torchX % 140), yoyo: true, repeat: -1 })
    }
  }

  // ── shared wall features — thick castle columns at room edges ────────────────
  private buildWallFeatures(w: number) {
    // Left wall column — purple-grey stone with cosmic edge glow
    this.add.rectangle(44, 360, 88, 720, 0x2a2248).setDepth(2)
    this.add.rectangle(22, 360, 44, 720, 0x1e1836).setDepth(2)
    this.add.rectangle(63, 360, 3, 720, 0x9966ee, 0.25).setDepth(3)
    // Brick mortar lines on left wall
    for (let by = 0; by < 720; by += 48) {
      this.add.rectangle(32, by + 24, 64, 2, 0x150e28, 0.85).setDepth(2)
    }
    // Right wall column
    this.add.rectangle(w - 44, 360, 88, 720, 0x2a2248).setDepth(2)
    this.add.rectangle(w - 22, 360, 44, 720, 0x1e1836).setDepth(2)
    this.add.rectangle(w - 63, 360, 3, 720, 0x9966ee, 0.25).setDepth(3)
    for (let by = 0; by < 720; by += 48) {
      this.add.rectangle(w - 32, by + 24, 64, 2, 0x150e28, 0.85).setDepth(2)
    }
  }

  // ── collectibles ──────────────────────────────────────────────────────────────

  private setupCollectibles() {
    const isInsideWall = (x: number, y: number): boolean =>
      this.tilemapLayers.some(layer => {
        const tile = layer.getTileAtWorldXY(x, y)
        return tile !== null && tile.index >= 0
      })

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const letterBugIdx: Record<number, number> = { 1: 0, 2: 0 }
    for (const item of this.cfg.items) {
      if (isInsideWall(item.x, item.y)) continue

      // Key jar: breakable destructible — player attacks break it and drop the key
      if (item.type === 'key-jar') {
        const alreadyHaveKey = !!(this.registry.get(`hasLevel${item.keyLevel ?? 1}Key`))
        if (!alreadyHaveKey) this.spawnKeyJar(item.x, item.y, item.keyLevel ?? 1)
        continue
      }

      // Letter bug: colored beetle with a letter on its back
      if (item.type === 'letter-bug') {
        const kl = item.keyLevel ?? 1
        const idx = letterBugIdx[kl] ?? 0
        letterBugIdx[kl] = idx + 1
        const storedPositions: Array<{x: number, y: number}> | null = this.registry.get(`level${kl}BugPositions`)
        const bugX = storedPositions?.[idx]?.x ?? item.x
        const bugY = storedPositions?.[idx]?.y ?? item.y
        item.x = bugX; item.y = bugY
        const bugLetters: string[] = this.registry.get(`level${kl}BugLetters`) ?? []
        item.letter = bugLetters[idx] ?? '?'
        const frame = Phaser.Math.Between(0, 15)
        const bugImg = this.add.image(0, 0, 'letter-bugs', frame).setScale(0.8)
        const txt    = this.add.text(0, 2, item.letter, {
          fontSize: '13px', fontFamily: FONT, color: '#ffffff',
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5)
        const container = this.add.container(bugX, bugY, [bugImg, txt]).setDepth(8)
        container.setData('item', item)
        this.tweens.add({
          targets: container, y: bugY - 12,
          duration: 900 + Phaser.Math.Between(-100, 100), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        this.collectibleSprites.push(container as unknown as Phaser.GameObjects.Image)
        continue
      }

      const isSuperAbility = item.type === 'speed' || item.type === 'attack-boost' || item.type === 'invulnerability'
      if (isSuperAbility && !isLocalhost) continue
      const tex = item.type === 'heart'            ? 'item-heart'
                : item.type === 'pizza'            ? 'item-pizza'
                : item.type === 'life'             ? 'item-life'
                : item.type === 'mystery'          ? 'item-mystery'
                : item.type === 'invulnerability'  ? 'invulnerability_icon'
                : item.type === 'key'              ? 'item-key'
                : 'item-orb'
      const isHidden = item.type === 'speed' || item.type === 'attack-boost' || item.type === 'invulnerability'
      const img = this.add.image(item.x, item.y, tex).setDepth(8)
        .setScale(item.type === 'mystery' ? 2.2 : 1.2)
      if (item.type === 'pizza') img.setDisplaySize(56, 56)
      if (isHidden) img.setAlpha(0)
      img.setData('item', item)
      this.tweens.add({
        targets: img, y: item.y - 12,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      this.collectibleSprites.push(img)
    }
  }

  private collectItem(player: Player, item: ItemSpawn) {
    if (item.type === 'heart' || item.type === 'pizza') {
      player.hearts = Math.min(5, player.hearts + 1)
      this.showPopup(item.x, item.y, item.type === 'pizza' ? '+PIZZA' : '+HEART', '#ff4d6a')
      SoundManager.collectHeart()
    } else if (item.type === 'life') {
      const lives: number = (this.registry.get('lives') ?? 1) + 1
      this.registry.set('lives', lives)
      this.showPopup(item.x, item.y, '1-UP!', '#ffe066')
      SoundManager.collectLife()
    } else if (item.type === 'mystery') {
      this.triggerMysteryEffect(player)
      SoundManager.collectMystery()
    } else if (item.type === 'speed') {
      player.applySpeedBoost(true)
      this.showPopup(item.x, item.y, 'SPEED UP!', '#ffe066')
      SoundManager.collectAbility()
    } else if (item.type === 'attack-boost') {
      player.applyStrengthBoost(true)
      this.showPopup(item.x, item.y, 'POWER UP!', '#ff4444')
      SoundManager.collectAbility()
    } else if (item.type === 'letter-bug') {
      const letter = item.letter ?? '?'
      const collected: string[] = [...(this.registry.get('collectedLetters') ?? [])]
      collected.push(letter)
      this.registry.set('collectedLetters', collected)
      this.ui.updateLetters(collected)
      this.showPopup(item.x, item.y, `LETTER  ${letter}!`, '#aaffcc')
      SoundManager.collectHeart()
    } else if (item.type === 'invulnerability') {
      player.applyInvulnerability(true)
      this.showPopup(item.x, item.y, 'INVINCIBLE!', '#4499ff')
      SoundManager.collectAbility()
    } else if (item.type === 'key') {
      const lvl = item.keyLevel ?? 1
      this.registry.set(`hasLevel${lvl}Key`, true)
      this.showPopup(item.x, item.y, 'YOU FOUND A KEY!', '#ffdd00')
      SoundManager.collectAbility()
    }
    this.addScore(500)
  }

  private triggerMysteryEffect(player: Player) {
    const isGood = Math.random() < 0.5
    if (isGood) {
      const r = Math.floor(Math.random() * 3)
      if (r === 0) {
        player.hearts = Math.min(5, player.hearts + 1)
        this.showPopup(player.x, player.y - 32, '+ HEART!', '#ff4d6a')
      } else if (r === 1) {
        player.applyStrengthBoost(false)
        this.showPopup(player.x, player.y - 32, 'POWER UP!', '#ff4444')
      } else {
        player.applyTempEffect('fast', 5000)
        this.showPopup(player.x, player.y - 32, 'SPEED UP!', '#ffe066')
      }
    } else {
      const r = Math.floor(Math.random() * 3)
      if (r === 0) {
        player.hitByEnemy()
        this.showPopup(player.x, player.y - 32, '- HEART', '#ff4444')
      } else if (r === 1) {
        this.spawnMysteryEnemies(player, 2)
        this.showPopup(player.x, player.y - 32, 'AMBUSH!', '#ff6600')
      } else {
        player.applyTempEffect('reverse', 4000)
        this.showPopup(player.x, player.y - 32, 'REVERSED!', '#cc00ff')
      }
    }
  }

  private spawnMysteryEnemies(near: Player, count: number) {
    const abilities = [AbilityType.Fire, AbilityType.Lightning, AbilityType.Ice]
    for (let i = 0; i < count; i++) {
      const ability = abilities[Math.floor(Math.random() * abilities.length)]
      const ex = near.x + (i === 0 ? -120 : 120)
      const enemy = new Enemy(this, ex, near.y - 10, ability)
      this.enemies.push(enemy)
      this.enemyGroup.add(enemy)
      this.physics.add.collider(enemy, this.platforms)
    }
  }

  private showPopup(x: number, y: number, text: string, color: string) {
    const popup = this.add.text(x, y - 16, text, {
      fontSize: '11px', fontFamily: FONT, color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50)
    this.tweens.add({
      targets: popup, y: y - 70, alpha: 0,
      duration: 1400, ease: 'Power2',
      onComplete: () => popup.destroy(),
    })
  }

  // ── NPC helpers ─────────────────────────────────────────────────────────────

  private showNpcBubble(
    x: number, y: number,
    lines: string[],
    duration: number | null,
  ): Phaser.GameObjects.Container {
    const FONT_SIZE = 8
    const PADDING   = 10
    const LINE_H    = 14

    const texts = lines.map((line, i) =>
      this.add.text(0, i * LINE_H, line, {
        fontSize: `${FONT_SIZE}px`, fontFamily: FONT, color: '#111111',
      }).setDepth(2).setOrigin(0, 0),
    )

    const maxW  = Math.max(...texts.map(t => t.width))
    const boxW  = maxW + PADDING * 2
    const boxH  = lines.length * LINE_H + PADDING * 2 - (LINE_H - FONT_SIZE)

    texts.forEach((t, i) => t.setPosition(-maxW / 2, -boxH / 2 + PADDING + i * LINE_H))

    const bg   = this.add.rectangle(0, 0, boxW, boxH, 0xfffde7, 0.97)
      .setStrokeStyle(2, 0x444444).setDepth(2)
    const tail = this.add.triangle(0, boxH / 2 + 1, -6, 0, 6, 0, 0, 10, 0xfffde7, 0.97)
      .setDepth(2)

    const ctr = this.add.container(x, y, [bg, tail, ...texts]).setDepth(2)

    if (duration !== null) {
      this.time.delayedCall(duration, () => {
        if (!ctr.active) return
        this.tweens.add({ targets: ctr, alpha: 0, duration: 500, onComplete: () => { if (ctr.active) ctr.destroy() } })
      })
    }
    return ctr
  }

  private drawCage(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g   = this.add.graphics().setDepth(2)
    const hw  = w / 2
    const hh  = h / 2
    const BAR = 4
    const N   = 5
    g.fillStyle(0x5a5a7a, 1)
    g.fillRect(x - hw, y - hh, w, BAR)
    g.fillRect(x - hw, y + hh - BAR, w, BAR)
    for (let i = 0; i <= N; i++) {
      const bx = x - hw + i * (w / N)
      g.fillRect(bx - BAR / 2, y - hh, BAR, h)
    }

    // Padlock centered slightly below the cage midpoint
    const lx = x, ly = y + 10
    const bw = 26, bh = 20, sr = 9
    g.lineStyle(5, 0xcc9900, 1)
    g.beginPath()
    g.arc(lx, ly - bh / 2, sr, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false)
    g.strokePath()
    g.fillStyle(0xffd700, 1)
    g.fillRoundedRect(lx - bw / 2, ly - bh / 2, bw, bh, 3)
    g.fillStyle(0x553300, 1)
    g.fillCircle(lx, ly + 2, 3.5)
    g.fillRect(lx - 2, ly + 2, 4, 7)

    return g
  }

  private npcCharNames(): string {
    const chars: string[] = this.registry.get('selectedChars') ?? ['friend']
    const names = chars.map(k => k.charAt(0).toUpperCase() + k.slice(1))
    return names.length === 1 ? names[0] : names.slice(0, -1).join(' & ') + ' & ' + names[names.length - 1]
  }

  // ── NPC spawn system ─────────────────────────────────────────────────────────

  private buildNPCs() {
    const runIndex: number = this.registry.get('runIndex') ?? 0
    const dk = this.cfg.bossDefeatedKey
    if (runIndex === 0 && !this.cfg.isBossRoom) this.buildWorldOneNPCs()
    else if (dk === 'skeletonKingDefeated') this.buildSkeletonKingNPCs()
    else if (dk === 'zombieKingDefeated') this.buildZombieKingNPCs()
    else if (dk === 'celeryManDefeated') this.buildCeleryManNPCs()
  }

  private buildWorldOneNPCs() {
    this.add.image(602, 892, 'sheet-enemy-duck', 11).setDepth(2).setScale(1.5).setFlipX(true)
    this.showNpcBubble(602, 808, [
      'Find the letter bugs ',
      'hidden in each level!',
      'Collect them all. Only',
      'the magic jar knows ',
      'the secret word.',
    ], null)
  }

  private buildSkeletonKingNPCs() {
    if (this.registry.get('dadSaved')) return

    this.dadNpcSprite  = this.add.image(633, 791, 'npc-dad', 14).setDepth(2).setScale(1.5)
    this.dadCageGfx    = this.drawCage(633, 791, 80, 100)
    this.dadCageBubble = this.showNpcBubble(633, 710, ['Help! Find letter', 'bugs & magic jar!'], null)
  }

  private buildZombieKingNPCs() {
    if (this.registry.get('momSaved')) return

    this.momNpcSprite  = this.add.image(542, 1079, 'npc-mom', 12).setDepth(2).setScale(1.5)
    this.momCageGfx    = this.drawCage(542, 1079, 80, 100)
    this.momCageBubble = this.showNpcBubble(542, 998, ['Help! Find letter', 'bugs & magic jar!'], null)
  }

  private buildCeleryManNPCs() {
    const dadSaved = !!(this.registry.get('dadSaved'))
    const momSaved = !!(this.registry.get('momSaved'))
    const npcX = 700, npcY = 1948

    if (dadSaved && momSaved) {
      const dadImg = this.add.image(npcX - 35, npcY, 'npc-dad', 8).setDepth(2).setScale(1.5)
      const momImg = this.add.image(npcX + 35, npcY, 'npc-mom', 15).setDepth(2).setScale(1.5)

      this.showNpcBubble(npcX, npcY - 100, [
        `Keep going, ${this.npcCharNames()}!`,
        'Walk past us for',
        'a special boost!',
      ], 6000)

      // Abilities granted once players walk past the NPCs (checkCeleryBoost in update loop)
      this.celeryNpcX = npcX

      this.time.delayedCall(6500, () => {
        if (!dadImg.active) return
        this.tweens.add({
          targets: [dadImg, momImg], alpha: 0, duration: 800,
          onComplete: () => { dadImg.destroy(); momImg.destroy() },
        })
      })
    } else {
      this.add.image(npcX, npcY, 'sheet-enemy-duck', 11).setDepth(2).setScale(1.5).setFlipX(true)
      this.showNpcBubble(npcX, npcY - 90, [
        'You cannot defeat',
        'Celery Man without',
        'saving Mom & Dad first!',
      ], null)
    }
  }

  // ── parent freed logic ───────────────────────────────────────────────────────

  private freeDad() {
    if (!this.dadNpcSprite?.active) return
    this.registry.set('dadSaved', true)

    this.dadCageGfx?.destroy()
    this.dadCageGfx = null
    this.dadCageBubble?.destroy()
    this.dadCageBubble = null
    this.dadNpcSprite.setFrame(11)

    const momSaved = !!(this.registry.get('momSaved'))
    const dadBubble = this.showNpcBubble(this.dadNpcSprite.x, this.dadNpcSprite.y - 100, [
      `Thank you, ${this.npcCharNames()}!`,
      momSaved ? "I'll have something" : 'Now hurry and',
      momSaved ? 'special waiting!'    : 'save Mom!',
    ], null)

    this.time.delayedCall(30000, () => {
      if (!this.dadNpcSprite?.active) return
      this.tweens.add({
        targets: [this.dadNpcSprite, dadBubble], alpha: 0, duration: 1500,
        onComplete: () => { this.dadNpcSprite?.destroy(); this.dadNpcSprite = null; dadBubble.destroy() },
      })
    })
  }

  private freeMom() {
    if (!this.momNpcSprite?.active) return
    this.registry.set('momSaved', true)

    this.momCageGfx?.destroy()
    this.momCageGfx = null
    this.momCageBubble?.destroy()
    this.momCageBubble = null
    this.momNpcSprite.setFrame(15)

    const momBubble = this.showNpcBubble(this.momNpcSprite.x, this.momNpcSprite.y - 100, [
      `Thank you, ${this.npcCharNames()}!`,
      "I'll have special",
      'abilities waiting',
      'at Celery Man!',
    ], null)

    this.time.delayedCall(30000, () => {
      if (!this.momNpcSprite?.active) return
      this.tweens.add({
        targets: [this.momNpcSprite, momBubble], alpha: 0, duration: 1500,
        onComplete: () => { this.momNpcSprite?.destroy(); this.momNpcSprite = null; momBubble.destroy() },
      })
    })
  }

  private canSpellWord(word: string, collected: string[]): boolean {
    const pool = [...collected]
    for (const letter of word.split('')) {
      const idx = pool.indexOf(letter)
      if (idx === -1) return false
      pool.splice(idx, 1)
    }
    return true
  }

  private assignLetterBugLetters(word: string, numBugs: number): string[] {
    const wordLetters = word.split('')
    const usedSet = new Set(wordLetters)
    const distPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !usedSet.has(l))
    Phaser.Utils.Array.Shuffle(distPool)
    const extras = distPool.slice(0, Math.max(0, numBugs - wordLetters.length))
    return Phaser.Utils.Array.Shuffle([...wordLetters, ...extras]) as string[]
  }

  private initLevelWords() {
    const runIndex: number = this.registry.get('runIndex') ?? 0
    if (runIndex === 0 && !this.cfg.isBossRoom && !this.registry.get('level1Word')) {
      const word = WORD_LIST_L1[Math.floor(Math.random() * WORD_LIST_L1.length)]
      this.registry.set('level1Word', word)
      this.registry.set('level1BugLetters', this.assignLetterBugLetters(word, TOTAL_LETTER_BUGS))
      if (this.cfg.letterBugPool) {
        const positions = (Phaser.Utils.Array.Shuffle([...this.cfg.letterBugPool]) as Array<{x: number, y: number}>).slice(0, TOTAL_LETTER_BUGS)
        this.registry.set('level1BugPositions', positions)
      }
    }
    if (runIndex === 2 && !this.cfg.isBossRoom && !this.registry.get('level2Word')) {
      const word = WORD_LIST_L2[Math.floor(Math.random() * WORD_LIST_L2.length)]
      this.registry.set('level2Word', word)
      this.registry.set('level2BugLetters', this.assignLetterBugLetters(word, TOTAL_LETTER_BUGS))
      if (this.cfg.letterBugPool) {
        const positions = (Phaser.Utils.Array.Shuffle([...this.cfg.letterBugPool]) as Array<{x: number, y: number}>).slice(0, TOTAL_LETTER_BUGS)
        this.registry.set('level2BugPositions', positions)
      }
    }
  }

  private updateParentHints() {
    const PROX = 140

    const collected: string[] = this.registry.get('collectedLetters') ?? []

    const handleParent = (
      sprite:    Phaser.GameObjects.Image | null,
      bossKey:   string,
      levelWord: string,
      keyReg:    string,
      freeFn:    () => void,
      bubble:    Phaser.GameObjects.Container | null,
      setBubble: (b: Phaser.GameObjects.Container | null) => void,
    ) => {
      if (!sprite?.active) return
      const bossOk  = !!(this.registry.get(bossKey))
      const countOk = levelWord ? this.canSpellWord(levelWord, collected) : false
      const keyOk   = !!(this.registry.get(keyReg))

      const near = this.players.some(p =>
        p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, sprite.x, sprite.y) < PROX
      )

      // All conditions met and player is close → liberate immediately
      if (bossOk && countOk && keyOk && near) {
        if (bubble?.active) { bubble.destroy(); setBubble(null) }
        freeFn()
        return
      }

      // Only show hints once the boss is beaten
      if (!bossOk) return

      const lines = (!countOk && !keyOk) ? ['Find letter bugs!', 'Also find magic jar!']
                  : !countOk             ? ['Find more letter bugs!']
                  :                        ['Find the magic jar!']

      if (near && !bubble?.active) {
        setBubble(this.showNpcBubble(sprite.x, sprite.y - 160, lines, null))
      } else if (!near && bubble?.active) {
        bubble.destroy()
        setBubble(null)
      }
    }

    const level1Word: string = this.registry.get('level1Word') ?? ''
    const level2Word: string = this.registry.get('level2Word') ?? ''

    handleParent(
      this.dadNpcSprite, 'skeletonKingDefeated', level1Word, 'hasLevel1Key',
      () => this.freeDad(),
      this.dadHintBubble, b => { this.dadHintBubble = b },
    )

    handleParent(
      this.momNpcSprite, 'zombieKingDefeated', level2Word, 'hasLevel2Key',
      () => this.freeMom(),
      this.momHintBubble, b => { this.momHintBubble = b },
    )
  }

  // ── level ───────────────────────────────────────────────────────────────────

  private buildLevel() {
    this.platforms = this.physics.add.staticGroup()
    this.projectiles = this.physics.add.group()
    this.enemyGroup  = this.physics.add.group()
    this.enemyProjectiles = this.physics.add.group()

    if (this.cfg.worldMap) {
      // ── Tilemap world: create Phaser tile layers, mark collision tiles ──────
      const { key, tileKey, tilesetName, section, renderOffset } = this.cfg.worldMap
      const map = this.make.tilemap({ key })
      const tileset = map.addTilesetImage(tilesetName, tileKey)!
      const tileH = map.tileHeight   // 32 for castle maps, 16 for outside map
      const SCALE = section ? 720 / (section.rows * tileH) : 1
      const ox = (section ? -(section.col * tileH * SCALE) : 0) + (renderOffset?.x ?? 0)
      const oy = (section ? -(section.row * tileH * SCALE) : 0) + (renderOffset?.y ?? 0)

      const mkLayer = (name: string, depth: number, collide = false) => {
        const layer = map.createLayer(name, tileset, ox, oy)
        if (!layer) return null
        if (SCALE !== 1) layer.setScale(SCALE)
        layer.setDepth(depth)
        if (collide) layer.setCollisionByExclusion([-1])
        return layer
      }

      const ml = this.cfg.worldMapLayers
      const bgName      = ml?.background ?? 'Background walls'
      const solidNames  = ml?.solid      ?? ['Walls', 'Platforms large', 'Platform small']
      const overlayNames = ml?.overlay   ?? ['Banner', 'Windows']

      const bgLayer      = mkLayer(bgName, -2)
      const solidLayers  = solidNames.map((n: string) => mkLayer(n, 1, true))
      const overlayLayers = overlayNames.map((n: string, i: number) => mkLayer(n, 3 + i * 2))

      // Dark rooms (levels 5-7+): tint tile layers with grey/purple hues
      if (this.cfg.isDark) {
        const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
        tint(bgLayer, 0x404060)                        // dark purple-grey background
        solidLayers.forEach(l  => tint(l,  0x585878))  // medium grey-purple solids
        overlayLayers.forEach(l => tint(l, 0x686898))  // slightly lighter purple overlay
      }

      this.tilemapLayers = solidLayers.filter((l: Phaser.Tilemaps.TilemapLayer | null): l is Phaser.Tilemaps.TilemapLayer => l !== null)

      // Build explicit static bodies from tile data — guarantees collision even
      // when Phaser's built-in tilemap physics is unreliable at certain scales.
      this.tilemapLayers.forEach(l => this.addTileLayerBodies(l, SCALE, ox, oy))

      // Scan downward from fromY to find a horizontal floor surface.
      // Requires: the tile is solid AND the tiles above it (up to clearanceTiles)
      // are all empty — this rules out vertical walls and embedded positions.
      const findFloorSurface = (worldX: number, fromY: number, clearanceTiles = 4): number | null => {
        const tileCol = Math.floor(worldX / (32 * SCALE))
        const isSolid = (col: number, row: number) =>
          this.tilemapLayers.some(l => { const t = l.getTileAt(col, row); return t !== null && t.index !== -1 })
        for (let row = Math.floor(fromY / (32 * SCALE)); row < map.height; row++) {
          if (!isSolid(tileCol, row)) continue
          // Verify required clearance above is all open air
          let clear = true
          for (let above = 1; above <= clearanceTiles; above++) {
            if (row - above >= 0 && isSolid(tileCol, row - above)) { clear = false; break }
          }
          if (clear) return row * 32 * SCALE + oy
        }
        return null
      }

      for (const fs of (this.cfg.furnitureSpawns ?? [])) {
        const fh = fs.type === 'bookcase' ? 80 : fs.type === 'table' ? 36 : 40
        let furnY: number
        if (fs.y !== undefined) {
          furnY = fs.y
        } else {
          const floorY = findFloorSurface(fs.x, fs.scanFromY ?? 0)
          if (floorY === null) continue
          furnY = floorY - fh / 2
        }
        const hp = fs.type === 'chest' ? 3 : fs.type === 'bookcase' ? 2 : 1
        this.spawnFurniturePiece(fs.type, fs.x, furnY, fs.ability ?? AbilityType.None, hp, {}, fs.pizzaDrop)
      }

      // Floor spike tiles
      for (const sf of (this.cfg.spikeFloors ?? [])) {
        const tex1 = sf.variant === 2 ? 'spike-floor2' : 'spike-floor1'
        const tex2 = sf.variant === 2 ? 'spike-floor1' : 'spike-floor2'
        const sc   = sf.scale ?? 1
        const step = Math.round(sc * 32)
        const end  = sf.xEnd ?? sf.x
        let idx = 0
        for (let sx = Math.min(sf.x, end); sx <= Math.max(sf.x, end); sx += step, idx++) {
          const img = this.physics.add.image(sx + step / 2, sf.y, idx % 2 === 0 ? tex1 : tex2)
            .setDepth(3).setScale(sc)
          ;(img.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
          ;(img.body as Phaser.Physics.Arcade.Body).setImmovable(true)
          this.spikeFloorTiles.push(img)
        }
      }

      for (const e of this.cfg.enemies) {
        const enemy = new Enemy(this, e.x, e.y, e.ability)
        this.enemies.push(enemy); this.enemyGroup.add(enemy)
      }
      for (const c of this.cfg.crates) {
        const crate = this.physics.add.image(c.x, c.y, 'crate')
        ;(crate.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false)
        crate.setDisplaySize(32, 32); this.crates.push(crate)
      }
      if (this.cfg.isBossRoom && this.cfg.bossSpawnX && this.cfg.bossHp) {
        const bossY = this.cfg.bossSpawnY ?? 620
        const W     = this.cfg.worldWidth
        const bossAlreadyDefeated: boolean = !!(this.cfg.bossDefeatedKey && this.registry.get(this.cfg.bossDefeatedKey))
        if (bossAlreadyDefeated) {
          // Boss already beaten — passthrough: exits open, no respawn
          this.bossDefeated = true
          const runRooms0: RoomConfig[] = this.registry.get('runRooms') ?? []
          const runIndex0: number       = this.registry.get('runIndex') ?? 0
          if (runIndex0 + 1 < runRooms0.length) this.openLevel2Exit(W)
        } else {
          // Seal both exits until the boss dies
          const barrierH = this.cfg.worldHeight ?? 720
          const barrier = this.add.rectangle(this.cfg.bossLeftBarrierX ?? 150, barrierH / 2, 20, barrierH, 0x000000, 0)
          this.physics.add.existing(barrier, true)
          this.platforms.add(barrier as unknown as Phaser.Physics.Arcade.Image)
          this.bossRoomLeftBarrier = barrier

          const rBarrier = this.add.rectangle(this.cfg.bossRightBarrierX ?? W - 150, this.cfg.bossRightBarrierY ?? barrierH / 2, 20, barrierH, 0x000000, 0)
          this.physics.add.existing(rBarrier, true)
          this.platforms.add(rBarrier as unknown as Phaser.Physics.Arcade.Image)
          this.bossRoomRightBarrier = rBarrier

          this.boss = new Boss(this, this.cfg.bossSpawnX, bossY, this.cfg.bossHp, 3000, this.cfg.bossKey, this.cfg.bossFlying !== false, this.cfg.bossStationary ?? false, this.cfg.bossAttackRate ?? 3000, this.cfg.bossScale ?? 3.45)
          this.boss.on('bossDead', () => {
            this.bossDefeated = true
            if (this.cfg.bossDefeatedKey) this.registry.set(this.cfg.bossDefeatedKey, true)
            if (this.bossRoomLeftBarrier) {
              ;(this.bossRoomLeftBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = false
              this.bossRoomLeftBarrier = null
            }
            if (this.bossRoomRightBarrier) {
              ;(this.bossRoomRightBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = false
              this.bossRoomRightBarrier = null
            }
            SoundManager.bossDeath()
            this.cameras.main.shake(300, 0.010)
            this.showPopup(W / 2, 400, 'BOSS DEFEATED!', '#ffe066')
            this.addScore(2000)
            this.ui.hideBossBar()

            const runRooms: RoomConfig[] = this.registry.get('runRooms') ?? []
            const runIndex: number       = this.registry.get('runIndex') ?? 0
            const dk = this.cfg.bossDefeatedKey
            const hasCutscene = dk === 'skeletonKingDefeated' || dk === 'zombieKingDefeated'
            const cutsceneSuffix = dk === 'skeletonKingDefeated' ? 'skeleton_king' : 'zombie_king'

            if (hasCutscene) {
              // Show cutscene immediately — it handles its own music
              this.showBossCutscene(cutsceneSuffix, () => {
                if (this.cfg.backPortal) this.buildBackPortal()
                if (runIndex + 1 < runRooms.length) this.openLevel2Exit(W)
                else this.showBossDefeatedOverlay()
              })
            } else if (dk === 'celeryManDefeated') {
              this.showPlaceholderCutscene('You defeated Celery Man!', () => {
                if (this.cfg.backPortal) this.buildBackPortal()
                if (runIndex + 1 < runRooms.length && !runRooms[runIndex + 1].isSecretBonus) this.openLevel2Exit(W)
                else this.showBossDefeatedOverlay()
              }, 'cutscene-celery-man-down')
            } else if (runIndex + 1 < runRooms.length && !runRooms[runIndex + 1].isSecretBonus) {
              // More levels — reveal right exit and back portal after brief celebration
              SoundManager.startTrack(this.sound, 'music-gameplay')
              if (this.cfg.backPortal) this.time.delayedCall(800, () => this.buildBackPortal())
              this.time.delayedCall(1800, () => { this.openLevel2Exit(W) })
            } else {
              // Final boss (or secret-bonus gate) — fanfare + overlay + hidden portal
              if (this.cfg.backPortal)   this.time.delayedCall(800, () => this.buildBackPortal())
              if (this.cfg.hiddenPortal) this.time.delayedCall(800, () => this.buildHiddenPortal())
              if (this.cfg.isSecretBonus) {
                this.time.delayedCall(1800, () => this.showCongratulatoryOverlay())
              } else {
                this.time.delayedCall(1800, () => this.showBossDefeatedOverlay())
              }
            }
          })
        }
      }

      if (this.cfg.bossPortal) {
        const { x, y } = this.cfg.bossPortal
        const cy = y - 106  // door center

        // Gradient glow radiating from arch (top/sides only, clipped at arch base)
        const archBottom = cy + 140
        const archGlow = this.add.graphics().setDepth(-1)
        for (let gi = 11; gi >= 0; gi--) {
          const t   = gi / 11                      // 1=outermost(dark), 0=at arch(bright)
          const exp = t * 90
          archGlow.fillStyle(0xff1100, (1 - t) * 0.35 + 0.02)
          archGlow.fillRoundedRect(
            x - 84 - exp, cy - 138 - exp,
            168 + 2 * exp, (archBottom - (cy - 138)) + exp,
            { tl: 72 + exp, tr: 72 + exp, bl: 0, br: 0 },
          )
        }
        this.tweens.add({ targets: archGlow, alpha: { from: 0.55, to: 1.0 }, duration: 1200, yoyo: true, repeat: -1 })

        // Stone arch frame: outer (depth 2), then inner recess overlaid on same graphic
        const arch = this.add.graphics().setDepth(2)
        arch.fillStyle(0x2a1a0e, 1)
        arch.fillRoundedRect(x - 84, cy - 138, 168, 278, { tl: 72, tr: 72, bl: 0, br: 0 })
        arch.fillStyle(0x150903, 1)
        arch.fillRoundedRect(x - 74, cy - 130, 148, 264, { tl: 62, tr: 62, bl: 0, br: 0 })

        // Keystone at arch crown
        this.add.rectangle(x, cy - 132, 22, 20, 0x3d2812).setDepth(2)
        this.add.rectangle(x, cy - 132, 12, 12, 0x5a3c1e, 0.75).setDepth(2)

        // Wood door panels — fill the rectangular portion of the inner arch opening
        // Inner arch rectangular portion starts at cy - 130 + 62 = cy - 68
        const panelTop = cy - 68
        const panelBot = cy + 134   // cy - 130 + 264
        const panelH   = panelBot - panelTop  // ≈ 202px

        const wp = this.add.graphics().setDepth(2)
        // Left panel base
        wp.fillStyle(0x6b3e1c, 1)
        wp.fillRect(x - 72, panelTop, 70, panelH)
        // Right panel base
        wp.fillStyle(0x6b3e1c, 1)
        wp.fillRect(x + 2, panelTop, 70, panelH)
        // Wood grain — horizontal lines across both panels
        for (let row = 4; row < panelH; row += 10) {
          const prominent = row % 30 === 0
          wp.fillStyle(prominent ? 0x3d2010 : 0x4e2c14, prominent ? 0.55 : 0.25)
          wp.fillRect(x - 72, panelTop + row, 70, prominent ? 3 : 2)
          wp.fillRect(x + 2,  panelTop + row, 70, prominent ? 3 : 2)
        }
        // Edge highlights (lighter strip on inner vertical edges)
        wp.fillStyle(0x8a5530, 0.30)
        wp.fillRect(x - 72, panelTop, 4, panelH)
        wp.fillRect(x + 68, panelTop, 4, panelH)

        // Center seam between the two doors
        this.add.rectangle(x, panelTop + panelH / 2, 4, panelH, 0x120804).setDepth(2)

        // Iron banding across both panels (3 horizontal bands with rivets)
        const bandYs = [cy - 30, cy + 40, cy + 100]
        bandYs.forEach(by => {
          this.add.rectangle(x, by,     140, 7, 0x252525).setDepth(2)
          this.add.rectangle(x, by - 1, 140, 3, 0x3c3c3c, 0.50).setDepth(2)
          ;[x - 56, x - 28, x + 2, x + 30, x + 58].forEach(rx => {
            this.add.circle(rx, by, 3, 0x2e2e2e).setDepth(2)
            this.add.circle(rx, by, 1, 0x4c4c4c).setDepth(2)
          })
        })

        // Ring knockers — one per door panel
        ;[-30, 30].forEach(ox => {
          this.add.circle(x + ox, cy + 38, 8, 0x8a6830).setDepth(2)
          this.add.circle(x + ox, cy + 38, 5, 0x241508).setDepth(2)
          this.add.circle(x + ox, cy + 46, 4, 0x8a6830).setDepth(2) // hanging ring
        })

        this.portalLabel = this.add.text(x, cy - 158, '↑ ENTER SANCTUM', {
          fontSize: '9px', fontFamily: FONT, color: '#000000',
        }).setOrigin(0.5).setDepth(11).setVisible(false)
        this.bossPortalPos = this.cfg.bossPortal
        const runRooms0: RoomConfig[] = this.registry.get('runRooms') ?? []
        const runIndex0: number       = this.registry.get('runIndex') ?? 0
        const nextBossKey = runRooms0[runIndex0 + 1]?.bossDefeatedKey
        if (nextBossKey && this.registry.get(nextBossKey)) this.portalLabel?.setText('↑ CONTINUE →')
      }

      // Non-glowing back portal — only visible when boss already defeated (CONTINUE mode)
      if (this.cfg.backPortal) {
        const gateKey = this.cfg.backPortalKey ?? this.cfg.bossDefeatedKey
        if (!!(gateKey && this.registry.get(gateKey))) this.buildBackPortal()
      }

      // Star-burst orb — boss room instant-kill collectible
      if (this.cfg.isBossRoom) {
        const orbX = this.cfg.starOrb ? this.cfg.starOrb.x : (this.cfg.starOrbSide === 'left' ? 120 : this.cfg.worldWidth - 120)
        const orbY = this.cfg.starOrb ? this.cfg.starOrb.y : 220
        const orbRing = this.add.circle(orbX, orbY, 22, 0x000000, 0)
          .setStrokeStyle(2, 0xffd700).setAlpha(0.45).setDepth(7)
        const orbImg  = this.add.star(orbX, orbY, 6, 8, 20, 0xffd700)
          .setAlpha(0.45).setDepth(8)
        this.tweens.add({ targets: [orbRing, orbImg], y: orbY - 10, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        this.tweens.add({ targets: orbImg, angle: 360, duration: 2200, repeat: -1 })

        let orbUsed = false
        const fireStarBurst = () => {
          orbUsed = true
          orbRing.destroy(); orbImg.destroy()
          this.cameras.main.flash(300, 255, 240, 80, false)
          // Instantly kill all enemies and boss — no star-contact required
          this.enemies.forEach(e => { if (e.active) { e.die(); this.addScore(SCORE_ENEMY) } })
          if (this.boss?.active) {
            ;(this.boss.body as Phaser.Physics.Arcade.Body).setEnable(false)
            this.boss.emit('hpChanged', 0, this.boss.maxHp)
            this.boss.bossDie()
          }
          // Pure visual star shower
          const COUNT = 32
          const starColors = [0xffd700, 0xff88ff, 0x88ffff, 0xff6644, 0xaaffaa, 0xffffff]
          for (let i = 0; i < COUNT; i++) {
            const angle = (i / COUNT) * Math.PI * 2
            const dist  = 500 + Math.random() * 700
            const gstar = this.add.star(orbX, orbY, 5, 4, 14, starColors[i % starColors.length]).setDepth(20)
            this.tweens.add({
              targets: gstar,
              x: orbX + Math.cos(angle) * dist,
              y: orbY + Math.sin(angle) * dist,
              alpha: 0, angle: 720,
              duration: 1000 + Math.random() * 700,
              ease: 'Power2',
              onComplete: () => gstar.destroy(),
            })
          }
        }

        // Reliable pickup: distance-checked every 50 ms (physics overlap was unreliable here)
        const pickupTimer = this.time.addEvent({
          delay: 50, loop: true,
          callback: () => {
            if (orbUsed) { pickupTimer.remove(); return }
            for (const p of this.players) {
              if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, orbX, orbY) < 52) {
                pickupTimer.remove()
                fireStarBurst()
                break
              }
            }
          },
        })
      }

      // Extra static barriers from config (e.g. boss room exit seals)
      for (const p of this.cfg.platforms) {
        const zone = this.add.zone(p.x, p.y, p.w, p.h)
        this.physics.add.existing(zone, true)
        this.platforms.add(zone as unknown as Phaser.Physics.Arcade.Image)
      }

      // Back exit — left world boundary in non-boss worldMap rooms past the first
      const backRunIndex: number = this.registry.get('runIndex') ?? 0
      if (!this.cfg.isBossRoom && backRunIndex > 0) {
        this.backExitPos = { x: 0, y: 0 }  // flag only; trigger uses p.x <= 100
      }

      // Optional visual barrier: draw a stone column to mark an exit seal
      if (this.cfg.barrierVisual) {
        const bv = this.cfg.barrierVisual
        const bx = bv.x - bv.w / 2
        const by = bv.y - bv.h / 2
        const g = this.add.graphics().setDepth(2)
        // Base fill — dark stone
        g.fillStyle(0x2c2040, 1)
        g.fillRect(bx, by, bv.w, bv.h)
        // Highlight left edge
        g.fillStyle(0x3c3058, 1)
        g.fillRect(bx, by, 3, bv.h)
        // Shadow right edge
        g.fillStyle(0x1a1028, 1)
        g.fillRect(bx + bv.w - 3, by, 3, bv.h)
        // Mortar lines every 32px to match tileset grid
        g.fillStyle(0x1c1532, 1)
        for (let row = 0; row <= bv.h; row += 32) {
          g.fillRect(bx, by + row, bv.w, 2)
        }
      }

      // Purple entrance glow at left edge
      if (this.cfg.exitGlowLeft) {
        const ey  = this.cfg.exitPositions?.left ?? 640
        const gy  = ey - 25
        const color = 0xcc55ff
        const gg = this.add.graphics().setDepth(3)
        for (let i = 9; i >= 0; i--) {
          const t   = i / 9
          const exp = t * 52
          gg.fillStyle(color, (1 - t) * 0.30 + 0.02)
          gg.fillRect(0, gy - 65 - exp, 16 + exp * 2, 130 + exp * 2)
        }
        gg.lineStyle(2, color, 0.90)
        gg.strokeRect(0, gy - 65, 16, 130)
        gg.lineStyle(3, color, 1)
        gg.beginPath(); gg.moveTo(0,  gy - 70); gg.lineTo(0,  gy + 70); gg.strokePath()
        gg.beginPath(); gg.moveTo(16, gy - 70); gg.lineTo(16, gy + 70); gg.strokePath()
        this.tweens.add({ targets: gg, alpha: { from: 0.65, to: 1 }, duration: 1200, yoyo: true, repeat: -1 })
      }

      // Purple exit glow at right edge
      if (this.cfg.comingSoonGlowRight) {
        const W2  = this.cfg.worldWidth
        const ey  = this.cfg.exitPositions?.right ?? 1952
        const gy  = ey - 25
        const color = 0xcc55ff
        const gg = this.add.graphics().setDepth(3)
        for (let i = 9; i >= 0; i--) {
          const t   = i / 9
          const exp = t * 52
          gg.fillStyle(color, (1 - t) * 0.30 + 0.02)
          gg.fillRect(W2 - 16 - exp, gy - 65 - exp, 16 + exp * 2, 130 + exp * 2)
        }
        gg.lineStyle(2, color, 0.90)
        gg.strokeRect(W2 - 16, gy - 65, 16, 130)
        gg.lineStyle(3, color, 1)
        gg.beginPath(); gg.moveTo(W2 - 16, gy - 70); gg.lineTo(W2 - 16, gy + 70); gg.strokePath()
        gg.beginPath(); gg.moveTo(W2,      gy - 70); gg.lineTo(W2,      gy + 70); gg.strokePath()
        this.tweens.add({ targets: gg, alpha: { from: 0.65, to: 1 }, duration: 1200, yoyo: true, repeat: -1 })
      }

      // Outdoor rooms: paint every solid tile with detailed grass/dirt colours
      if (this.cfg.isOutdoor && this.tilemapLayers.length > 0) {
        const solidLayer = this.tilemapLayers[0]
        const cols = solidLayer.layer.width
        const rows = solidLayer.layer.height
        const tw = Math.round(map.tileWidth  * SCALE)
        const th = Math.round(map.tileHeight * SCALE)
        const tileG = this.add.graphics().setDepth(2)

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const tile = solidLayer.getTileAt(c, r)
            if (!tile || tile.index < 0) continue

            const isSolid = (dr: number, dc: number) => {
              const nr = r + dr, nc = c + dc
              if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false
              const t2 = solidLayer.getTileAt(nc, nr)
              return t2 !== null && t2.index >= 0
            }
            const hasAbove = isSolid(-1, 0)
            const fullyInner = hasAbove && isSolid(1, 0) && isSolid(0, -1) && isSolid(0, 1)

            const wx = ox + c * tw
            const wy = oy + r * th

            // Deterministic per-tile seed for pebble placement
            const seed = (c * 31 + r * 17) & 0xff
            const px1 = (seed * 7) % (tw - 6) + 3
            const py1 = (seed * 5) % (th - 16) + 8
            const px2 = ((seed + 100) * 11) % (tw - 6) + 3
            const py2 = ((seed + 50)  *  9) % (th - 16) + 8
            const px3 = ((seed + 200) * 13) % (tw - 6) + 3
            const py3 = ((seed + 25)  *  3) % (th - 16) + 8

            if (!hasAbove) {
              // ── Surface tile (twilight palette) ───────────────────────────
              tileG.fillStyle(0x3a2448); tileG.fillRect(wx, wy +  9, tw, 9)   // topsoil (purple-brown)
              tileG.fillStyle(0x2c1838); tileG.fillRect(wx, wy + 18, tw, 7)   // upper dirt
              tileG.fillStyle(0x22122c); tileG.fillRect(wx, wy + 25, tw, 4)   // lower dirt
              tileG.fillStyle(0x180c20); tileG.fillRect(wx, wy + 29, tw, th - 29) // deep

              // World-aligned strata lines
              tileG.fillStyle(0x281040)
              const firstS = Math.ceil((wy + 15) / 8) * 8
              for (let sy = firstS; sy < wy + th - 1; sy += 8) {
                tileG.fillRect(wx + 2, sy, tw - 4, 1)
              }
              // Left-edge highlight and bottom shadow
              tileG.fillStyle(0x4a2c68); tileG.fillRect(wx, wy + 15, 1, th - 15)
              tileG.fillStyle(0x140a1c); tileG.fillRect(wx, wy + th - 2, tw, 2)

              // Pebbles
              tileG.fillStyle(0x201040)
              tileG.fillRect(wx + px1, wy + 16 + py1 % (th - 20), 2, 2)
              tileG.fillRect(wx + px2, wy + 16 + py2 % (th - 20), 2, 2)
              tileG.fillStyle(0x6040a0)
              tileG.fillRect(wx + px3, wy + 16 + py3 % (th - 20), 1, 1)

              // ── Grass cap (twilight blue-green) ───────────────────────────
              tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx + 2, wy,     tw - 4, 1)
              tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx + 1, wy + 1, tw - 2, 1)
              tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx,     wy + 2, tw, 2)
              tileG.fillStyle(0x1e4228); tileG.fillRect(wx,     wy + 4, tw, 2)
              tileG.fillStyle(0x142e1c); tileG.fillRect(wx,     wy + 6, tw, 3)

              // Ragged grass-dirt boundary
              const numG = Math.ceil(tw / 4)
              for (let gi = 0; gi < numG; gi++) {
                const gx  = wx + gi * 4
                const gw  = Math.min(4, tw - gi * 4)
                const gseed = (c * 37 + r * 13 + gi * 7) & 0x7
                const yVar  = (gseed % 5) - 2
                tileG.fillStyle(0x0e2018); tileG.fillRect(gx, wy + 9  + yVar, gw, 2)
                tileG.fillStyle(0x1a2e20); tileG.fillRect(gx, wy + 11 + yVar, gw, 2)
              }
              // Highlight sliver
              tileG.fillStyle(0x3a7050); tileG.fillRect(wx + 2, wy, Math.floor(tw * 0.35), 1)

            } else if (fullyInner) {
              // ── Fully surrounded — deep dark purple-earth ─────────────────
              tileG.fillStyle(0x1a0a28); tileG.fillRect(wx, wy, tw, th)

              tileG.fillStyle(0x120818)
              const firstS2 = Math.ceil(wy / 8) * 8
              for (let sy = firstS2; sy < wy + th - 1; sy += 8) {
                tileG.fillRect(wx + 2, sy, tw - 4, 1)
              }

              tileG.fillStyle(0x281848)
              tileG.fillRect(wx + px1, wy + py1, 2, 2)
              tileG.fillRect(wx + px2, wy + py2, 2, 2)
              tileG.fillStyle(0x140a24)
              tileG.fillRect(wx + px3, wy + py3, 1, 1)

            } else {
              // ── Partially exposed edge tile ───────────────────────────────
              tileG.fillStyle(0x2a1838); tileG.fillRect(wx, wy, tw, th)

              tileG.fillStyle(0x201040)
              const firstS3 = Math.ceil(wy / 8) * 8
              for (let sy = firstS3; sy < wy + th - 1; sy += 8) {
                tileG.fillRect(wx + 2, sy, tw - 4, 1)
              }

              tileG.fillStyle(0x160c20)
              tileG.fillRect(wx + px1, wy + py1, 2, 2)
              tileG.fillRect(wx + px2, wy + py2, 2, 2)
              tileG.fillStyle(0x4a3068)
              tileG.fillRect(wx + px3, wy + py3, 1, 1)
              tileG.fillStyle(0x3a2460); tileG.fillRect(wx, wy, 1, th)
            }
          }
        }
      }

      this.spawnSpikeBalls()
      return
    }

    const W = this.cfg.worldWidth
    const exits = this.cfg.exits
    const ep = this.cfg.exitPositions ?? {}

    const addTile = (x: number, y: number, w: number, h: number) => {
      const tile = this.add.tileSprite(x, y, w, h, this.cfg.tileset)
      this.physics.add.existing(tile, true)
      this.platforms.add(tile)
    }

    // Left wall — with or without a door gap
    // Boss room seals its left wall on entry; it opens only after boss dies.
    const leftDoorY  = ep.left   ?? 640
    if (!exits.includes('left') || this.cfg.isBossRoom) {
      const tile = this.add.tileSprite(8, 360, 16, 720, this.cfg.tileset)
      this.physics.add.existing(tile, true)
      this.platforms.add(tile)
      if (this.cfg.isBossRoom) this.bossRoomLeftWall = tile
    } else {
      const topH = leftDoorY - DOOR_H / 2
      const botY = leftDoorY + DOOR_H / 2
      if (topH > 0)       addTile(8, topH / 2,          16, topH)
      if (botY < 720)     addTile(8, botY + (720 - botY) / 2, 16, 720 - botY)
      this.doorGlow(0, leftDoorY - DOOR_H / 2, 16, DOOR_H)
    }

    // Right wall
    const rightDoorY = ep.right  ?? 640
    if (!exits.includes('right')) {
      addTile(W - 8, 360, 16, 720)
    } else {
      const topH = rightDoorY - DOOR_H / 2
      const botY = rightDoorY + DOOR_H / 2
      if (topH > 0)   addTile(W - 8, topH / 2,               16, topH)
      if (botY < 720) addTile(W - 8, botY + (720 - botY) / 2, 16, 720 - botY)
      this.doorGlow(W - 16, rightDoorY - DOOR_H / 2, 16, DOOR_H)
    }

    // Ceiling
    const topDoorX   = ep.top    ?? W / 2
    if (!exits.includes('top')) {
      addTile(W / 2, 8, W, 16)
    } else {
      const leftW  = topDoorX - DOOR_W / 2
      const rightX = topDoorX + DOOR_W / 2
      if (leftW > 0)  addTile(leftW / 2,              8, leftW,     16)
      if (rightX < W) addTile(rightX + (W - rightX) / 2, 8, W - rightX, 16)
      this.doorGlow(topDoorX - DOOR_W / 2, 0, DOOR_W, 16)
    }

    // Floor
    const botDoorX   = ep.bottom ?? W / 2
    if (!exits.includes('bottom')) {
      addTile(W / 2, 688, W, 32)
    } else {
      const leftW  = botDoorX - DOOR_W / 2
      const rightX = botDoorX + DOOR_W / 2
      if (leftW > 0)  addTile(leftW / 2,                 688, leftW,     32)
      if (rightX < W) addTile(rightX + (W - rightX) / 2, 688, W - rightX, 32)
      this.doorGlow(botDoorX - DOOR_W / 2, 672, DOOR_W, 32)
    }

    // Interior platforms
    for (const p of this.cfg.platforms) {
      addTile(p.x, p.y, p.w, p.h)
    }

    // Diagonal slopes: approximate with tight stepped tiles
    for (const sl of this.cfg.slopes ?? []) {
      const dx = sl.x2 - sl.x1
      const dy = sl.y2 - sl.y1
      const steps = Math.max(6, Math.round(Math.abs(dx) / 40))
      const sw = dx / steps
      const sh = dy / steps
      for (let i = 0; i < steps; i++) {
        addTile(sl.x1 + sw * (i + 0.5), sl.y1 + sh * i + 8, Math.abs(sw) + 2, 16)
      }
    }

    for (const d of this.cfg.destructibles) {
      const dest = new Destructible(this, d.x, d.y, d.health, d.ability, d.resistances ?? {})
      dest.setDisplaySize(d.w, d.h)
      this.destructibles.push(dest)
      dest.on('destroyed', (obj: Destructible) => {
        this.destructibles = this.destructibles.filter(x => x !== obj)
        this.addScore(SCORE_DESTRUCT)
        if (obj.abilityDrop !== AbilityType.None) this.spawnAbilityDrop(obj.x, obj.y, obj.abilityDrop)
      })
    }

    this.spawnRandomBreakables()

    for (const c of this.cfg.crates) {
      const crate = this.physics.add.image(c.x, c.y, 'crate')
      ;(crate.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false)
      crate.setDisplaySize(32, 32)
      this.crates.push(crate)
    }

    for (const e of this.cfg.enemies) {
      const enemy = new Enemy(this, e.x, e.y, e.ability)
      this.enemies.push(enemy)
      this.enemyGroup.add(enemy)
    }

    if (this.cfg.isBossRoom && this.cfg.bossSpawnX && this.cfg.bossHp) {
      this.boss = new Boss(this, this.cfg.bossSpawnX, this.cfg.bossSpawnY ?? 620, this.cfg.bossHp, 3000, this.cfg.bossKey, this.cfg.bossFlying !== false, this.cfg.bossStationary ?? false, this.cfg.bossAttackRate ?? 3000, this.cfg.bossScale ?? 3.45)
      this.boss.on('bossDead', () => {
        this.bossDefeated = true
        SoundManager.bossDeath()
        SoundManager.startTrack(this.sound, 'music-gameplay')
        this.cameras.main.shake(300, 0.010)
        this.showPopup(W / 2, 400, 'BOSS DEFEATED!', '#ffe066')
        this.addScore(2000)
        this.ui.hideBossBar()
        // Auto-transition to victory screen after celebration
        this.time.delayedCall(3200, () => {
          if (!this.roomTransitioning) {
            this.roomTransitioning = true
            this.cameras.main.fadeOut(900, 0, 0, 0)
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('VictoryScene'))
          }
        })
        // Unseal the left exit — fade out the wall and show the door frame
        if (this.bossRoomLeftWall) {
          const wall = this.bossRoomLeftWall
          ;(wall.body as Phaser.Physics.Arcade.StaticBody).enable = false
          this.tweens.add({
            targets: wall, alpha: 0, duration: 700,
            onComplete: () => {
              wall.destroy()
              this.bossRoomLeftWall = null
              this.doorGlow(0, 640 - DOOR_H / 2, 16, DOOR_H)
            },
          })
        }
      })
    }

    // Throne room door — rendered behind player (depth 1-2)
    if (this.cfg.isThrone) {

      this.throneX = W / 2
      const door = this.add.rectangle(W / 2, 620, 80, 120, 0x334466).setDepth(1)
      this.add.rectangle(W / 2, 620, 74, 114, 0x223355).setDepth(1)
      this.add.rectangle(W / 2, 620, 10, 40,  0xcb9b00).setDepth(1)  // handle
      this.tweens.add({ targets: door, fillColor: 0x445577, duration: 1400, yoyo: true, repeat: -1 })
      this.throneLabel = this.add.text(W / 2, 548, '↑ PRESS UP', {
        fontSize: '9px', fontFamily: FONT, color: '#aaccff',
      }).setOrigin(0.5).setDepth(11).setVisible(false)
    }

  }

  private spawnRandomBreakables() {
    if (this.cfg.worldMap) return
    const W = this.cfg.worldWidth
    const FLOOR_Y  = 672   // top surface of floor tile
    const BLOCK    = 32
    const abilityPool = [
      AbilityType.None, AbilityType.None, AbilityType.None, AbilityType.None,
      AbilityType.Fire, AbilityType.Lightning, AbilityType.Ice,
    ]

    const addBlock = (x: number, y: number, ability: AbilityType) => {
      const dest = new Destructible(this, x, y, 1, ability)
      this.destructibles.push(dest)
      dest.on('destroyed', (obj: Destructible) => {
        this.destructibles = this.destructibles.filter(z => z !== obj)
        this.addScore(SCORE_DESTRUCT)
        if (obj.abilityDrop !== AbilityType.None) this.spawnAbilityDrop(obj.x, obj.y, obj.abilityDrop)
      })
    }

    // Floor stacks — one group per 220px span, 150px margins at each wall
    const section = 220
    const numGroups = Math.floor((W - 300) / section)
    for (let i = 0; i < numGroups; i++) {
      const cx = 150 + i * section + Phaser.Math.Between(-30, 30)
      const stackH = Phaser.Math.Between(1, 3)
      const baseAbility = Phaser.Math.RND.pick(abilityPool) as AbilityType
      for (let s = 0; s < stackH; s++) {
        const y = FLOOR_Y - BLOCK / 2 - s * BLOCK
        addBlock(cx, y, s === 0 ? baseAbility : AbilityType.None)
      }
    }

    // Platform tops — 1-2 blocks per platform
    for (const plat of this.cfg.platforms) {
      if (Phaser.Math.Between(0, 1) === 0) continue
      const platTop = plat.y - plat.h / 2
      const xOff = Phaser.Math.Between(-Math.floor(plat.w / 4), Math.floor(plat.w / 4))
      const ability = Phaser.Math.RND.pick(abilityPool) as AbilityType
      addBlock(plat.x + xOff, platTop - BLOCK / 2, ability)
      if (plat.w >= 128 && Phaser.Math.Between(0, 1) === 1) {
        addBlock(plat.x + xOff + Phaser.Math.Between(40, 70), platTop - BLOCK / 2, AbilityType.None)
      }
    }

    this.spawnRoomFurnitureRandom()
  }

  private spawnSpikeBalls() {
    if (this.cfg.isBossRoom) return

    // Always generate a fresh procedural texture — avoids relying on the
    // preloaded spike-ball PNG which may be too small or poorly visible.
    const GFX = 'spike-ball-gfx'
    if (!this.textures.exists(GFX)) {
      const g = this.add.graphics()
      g.fillStyle(0x111122, 1)
      g.fillCircle(24, 24, 22)
      g.fillStyle(0x3366bb, 0.45)
      g.fillCircle(17, 16, 10)
      g.fillStyle(0x99aabb, 1)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        g.fillTriangle(
          24 + Math.cos(a) * 31, 24 + Math.sin(a) * 31,
          24 + Math.cos(a - 0.28) * 20, 24 + Math.sin(a - 0.28) * 20,
          24 + Math.cos(a + 0.28) * 20, 24 + Math.sin(a + 0.28) * 20,
        )
      }
      g.generateTexture(GFX, 48, 48)
      g.destroy()
    }

    const isInsideWall = (x: number, y: number): boolean =>
      this.tilemapLayers.some(layer => {
        const tile = layer.getTileAtWorldXY(x, y)
        return tile !== null && tile.index >= 0
      })

    const spawnBall = (x: number, y: number) => {
      // Relocate if inside a wall tile
      let bx = x, by = y
      if (this.tilemapLayers.length > 0 && isInsideWall(bx, by)) {
        const tries: [number, number][] = [[-32, 0], [32, 0], [0, -32], [0, 32], [-64, 0], [64, 0], [0, -64], [0, 64]]
        let cleared = false
        for (const [ox, oy] of tries) {
          if (!isInsideWall(x + ox, y + oy)) { bx = x + ox; by = y + oy; cleared = true; break }
        }
        if (!cleared) return
      }
      const ball = this.physics.add.image(bx, by, GFX).setDepth(9)
      const body = ball.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setBounce(1, 1)
      body.setCircle(20, 4, 4)
      body.setCollideWorldBounds(true)
      const spd = 110 + Math.random() * 70
      const ang = Math.random() * Math.PI * 2
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
      this.tweens.add({ targets: ball, angle: 360, duration: 1800 + Math.random() * 800, repeat: -1 })
      this.spikeBalls.push(ball)
    }

    for (const spawn of (this.cfg.spikeBalls ?? [])) {
      const count = spawn.count ?? 1
      for (let i = 0; i < count; i++) {
        spawnBall(
          spawn.x + Phaser.Math.Between(-32, 32),
          spawn.y + Phaser.Math.Between(-32, 32),
        )
      }
    }
  }

  private spawnFurniturePiece(
    type: 'bookcase' | 'table' | 'chest',
    x: number, y: number,
    ability: AbilityType,
    health = 2,
    resistances: Partial<Record<DamageType, number>> = {},
    pizzaDrop = false,
  ) {
    const visuals: Phaser.GameObjects.GameObject[] = []
    const v = <T extends Phaser.GameObjects.GameObject>(obj: T): T => { visuals.push(obj); return obj }
    let fw: number, fh: number

    if (type === 'bookcase') {
      fw = 40; fh = 80
      v(this.add.rectangle(x, y,      40, 80, 0x3d2208, 0.96).setDepth(3))
      v(this.add.rectangle(x - 18, y,  4, 80, 0x1e1004, 0.95).setDepth(4))
      v(this.add.rectangle(x + 18, y,  4, 80, 0x1e1004, 0.95).setDepth(4))
      v(this.add.rectangle(x, y - 40, 40,  4, 0x221208, 0.95).setDepth(4))
      v(this.add.rectangle(x, y,      40,  4, 0x2a1608, 0.90).setDepth(4))
      v(this.add.rectangle(x, y + 40, 40,  4, 0x221208, 0.95).setDepth(4))
      const bk = [0x8b0000, 0x003388, 0x225522, 0x884400, 0x553388, 0x887700]
      for (let b = 0; b < 4; b++) v(this.add.rectangle(x - 13 + b * 9, y - 20, 7, 22, bk[b % bk.length],       0.90).setDepth(4))
      for (let b = 0; b < 4; b++) v(this.add.rectangle(x - 13 + b * 9, y + 20, 7, 22, bk[(b + 2) % bk.length], 0.90).setDepth(4))

    } else if (type === 'table') {
      fw = 96; fh = 36
      v(this.add.rectangle(x,       y - 13, 96,  9, 0x5c3317, 0.98).setDepth(3))
      v(this.add.rectangle(x,       y - 10, 90,  4, 0x6e3e1e, 0.45).setDepth(4))
      v(this.add.rectangle(x,       y - 6,  86,  7, 0x3d1f0a, 0.88).setDepth(3))
      v(this.add.rectangle(x - 42,  y + 8,   6, 30, 0x3d1f0a, 0.95).setDepth(3))
      v(this.add.rectangle(x + 42,  y + 8,   6, 30, 0x3d1f0a, 0.95).setDepth(3))
      v(this.add.rectangle(x,       y + 18, 78,  4, 0x2a1208, 0.65).setDepth(3))
      const cx = x + Phaser.Math.Between(-25, 25)
      v(this.add.rectangle(cx, y - 24,  5, 12, 0xf0e8d8, 0.92).setDepth(4))
      const fl = v(this.add.rectangle(cx, y - 32, 5, 8, 0xffdd88, 0.88).setDepth(5))
      this.tweens.add({ targets: fl, scaleX: 0.55, scaleY: 0.72, duration: 85 + Phaser.Math.Between(0, 50), yoyo: true, repeat: -1 })

    } else { // chest
      fw = 48; fh = 40
      const cl = pizzaDrop                         ? 0x55cc22
               : ability === AbilityType.Fire     ? 0xff6600
               : ability === AbilityType.Lightning ? 0xffdd00
               : ability === AbilityType.Ice      ? 0x66ccff : 0xcb9b00
      v(this.add.rectangle(x,       y + 8,  48, 28, 0x5c3317, 0.98).setDepth(3))
      v(this.add.rectangle(x,       y + 6,  42,  2, 0x3d1f0a, 0.35).setDepth(4))
      v(this.add.rectangle(x,       y + 14, 42,  2, 0x3d1f0a, 0.35).setDepth(4))
      v(this.add.rectangle(x,       y - 10, 48, 16, 0x6b3d1e, 0.98).setDepth(3))
      v(this.add.rectangle(x,       y - 12, 44,  4, 0x7e4c28, 0.55).setDepth(4))
      v(this.add.rectangle(x - 21,  y,       4, 40, 0x444444, 0.75).setDepth(4))
      v(this.add.rectangle(x + 21,  y,       4, 40, 0x444444, 0.75).setDepth(4))
      v(this.add.rectangle(x,       y - 2,  48,  4, 0x444444, 0.65).setDepth(4))
      v(this.add.rectangle(x - 15,  y - 2,   6,  8, 0x777777, 0.90).setDepth(5))
      v(this.add.rectangle(x + 15,  y - 2,   6,  8, 0x777777, 0.90).setDepth(5))
      v(this.add.rectangle(x,       y - 2,  12, 10, cl,       0.90).setDepth(5))
      v(this.add.rectangle(x,       y - 2,   6,  5, 0x1a0a04, 0.65).setDepth(5))
      ;[-20, 20].forEach(rx => {
        v(this.add.circle(x + rx, y + 4,  2, 0x666666, 0.8).setDepth(4))
        v(this.add.circle(x + rx, y + 16, 2, 0x666666, 0.8).setDepth(4))
      })
    }

    const dest = new Destructible(this, x, y, health, ability, resistances)
    dest.setDisplaySize(fw, fh)
    dest.setAlpha(0)

    dest.on('hit', () => {
      visuals.forEach(go => {
        const a = (go as any).alpha as number
        ;(go as any).setAlpha(0.3)
        this.time.delayedCall(90, () => { if (go.active) (go as any).setAlpha(a) })
      })
    })

    this.destructibles.push(dest)
    dest.on('destroyed', (obj: Destructible) => {
      this.destructibles = this.destructibles.filter(z => z !== obj)
      this.addScore(SCORE_DESTRUCT)
      visuals.forEach(go => { if (go.active) go.destroy() })
      if (obj.abilityDrop !== AbilityType.None) this.spawnAbilityDrop(obj.x, obj.y, obj.abilityDrop)
      if (pizzaDrop) this.spawnPizzaDrop(obj.x, obj.y)
      if (Math.random() < 0.25) this.spawnFurnitureDrop(obj.x, obj.y)
    })
  }

  private spawnKeyJar(x: number, y: number, keyLevel: number) {
    const img  = this.add.image(x, y, 'item-key-jar').setDepth(3).setScale(1.5)
    const sign = this.spawnJarSign(x, y, keyLevel)

    // High health so it never shatters naturally — opening is handled via the word menu
    const dest = new Destructible(this, x, y, 9999, AbilityType.None, {})
    dest.setDisplaySize(40, 40)
    dest.setAlpha(0)
    dest.damageGuard = () => false  // always block damage, open only via word menu

    dest.on('blocked', () => {
      // Visual flash on every hit
      img.setAlpha(0.3)
      this.time.delayedCall(90, () => { if (img.active) img.setAlpha(1) })

      const lastAction: number = dest.getData('lastActionTime') ?? 0
      if (this.time.now - lastAction < 1200) return
      dest.setData('lastActionTime', this.time.now)

      const targetWord: string = this.registry.get(`level${keyLevel}Word`) ?? ''
      const collected: string[] = this.registry.get('collectedLetters') ?? []

      if (!targetWord || !this.canSpellWord(targetWord, collected)) {
        this.showPopup(x, y, 'Need letter bugs!', '#ff8888')
      } else {
        this.showWordMenu(x, y, keyLevel, () => {
          this.destructibles = this.destructibles.filter(z => z !== dest)
          if (dest.active) dest.destroy()
          if (img.active) img.destroy()
          if (sign.active) sign.destroy()
          this.spawnKeyDrop(x, y, keyLevel)
        })
      }
    })

    this.destructibles.push(dest)
  }

  private spawnJarSign(jarX: number, jarY: number, keyLevel: number): Phaser.GameObjects.Container {
    const BOARD_W = 160, BOARD_H = 62, POLE_H = 56

    const pole  = this.add.rectangle(0, BOARD_H / 2 + POLE_H / 2, 6, POLE_H, 0x5c3317)
    const board = this.add.rectangle(0, 0, BOARD_W, BOARD_H, 0xc49a44)
      .setStrokeStyle(2, 0x4a2a0a)
    const grain1 = this.add.rectangle(0, -10, BOARD_W - 12, 2, 0x8a6422, 0.45)
    const grain2 = this.add.rectangle(0,   2, BOARD_W - 12, 2, 0x8a6422, 0.45)
    const grain3 = this.add.rectangle(0,  14, BOARD_W - 12, 2, 0x8a6422, 0.45)

    const txt = this.add.text(0, 0, '', {
      fontSize: '8px', fontFamily: FONT, color: '#2a1505', align: 'center',
      wordWrap: { width: BOARD_W - 18 },
    }).setOrigin(0.5)

    const container = this.add.container(jarX - 200, jarY - 50, [pole, board, grain1, grain2, grain3, txt]).setDepth(3)

    const update = () => {
      if (!container.active) return
      const collected: string[] = this.registry.get('collectedLetters') ?? []
      const word: string        = this.registry.get(`level${keyLevel}Word`) ?? ''
      txt.setText(word && this.canSpellWord(word, collected)
        ? 'Break the jar!\nThat opens the\nmenu to select\nthe word.'
        : 'Find all of the\ncorrect letters\nto break the jar!')
    }
    update()

    let timer: Phaser.Time.TimerEvent
    timer = this.time.addEvent({ delay: 400, loop: true, callback: () => {
      if (!container.active) { timer.remove(); return }
      update()
    }})

    return container
  }

  private showWordMenu(jarX: number, jarY: number, keyLevel: number, onCorrect: () => void) {
    if (this.wordMenuObjects.length > 0) return

    const { width, height } = this.scale
    const targetWord: string = this.registry.get(`level${keyLevel}Word`) ?? 'BUG'
    const collected: string[] = this.registry.get('collectedLetters') ?? []
    const D    = 150
    const TILE = 52
    const GAP  = 12

    this.gm.pause()
    this.physics.world.isPaused = true

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(D).setInteractive()

    const title = this.add.text(width / 2, height * 0.18, 'MAGIC JAR!', {
      fontSize: '28px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    const sub = this.add.text(width / 2, height * 0.27, 'Spell the word:', {
      fontSize: '9px', fontFamily: FONT, color: '#aabbcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    // Target word displayed clearly
    const wordDisplay = this.add.text(width / 2, height * 0.36, targetWord, {
      fontSize: '28px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000', strokeThickness: 4,
      letterSpacing: 18,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    // Progress slots
    const N = targetWord.length
    const slotRowW   = N * TILE + (N - 1) * GAP
    const slotStartX = width / 2 - slotRowW / 2 + TILE / 2
    const slotY = height * 0.50

    const slotBoxes: Phaser.GameObjects.Rectangle[] = []
    const slotTexts: Phaser.GameObjects.Text[] = []
    for (let i = 0; i < N; i++) {
      const sx = slotStartX + i * (TILE + GAP)
      const box = this.add.rectangle(sx, slotY, TILE, TILE, 0x141428)
        .setStrokeStyle(2, 0x334455).setScrollFactor(0).setDepth(D)
      const txt = this.add.text(sx, slotY, '_', {
        fontSize: '20px', fontFamily: FONT, color: '#334455',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      slotBoxes.push(box)
      slotTexts.push(txt)
    }

    // Collected letter tiles
    const M = collected.length
    const tileRowW   = M * TILE + (M - 1) * GAP
    const tileStartX = width / 2 - tileRowW / 2 + TILE / 2
    const tileY = height * 0.60

    const tileBoxes: Phaser.GameObjects.Rectangle[] = []
    const tileTxts: Phaser.GameObjects.Text[] = []
    for (let i = 0; i < M; i++) {
      const tx = tileStartX + i * (TILE + GAP)
      const box = this.add.rectangle(tx, tileY, TILE, TILE, 0x223344)
        .setStrokeStyle(2, 0x556677).setScrollFactor(0).setDepth(D).setInteractive({ useHandCursor: true })
      const txt = this.add.text(tx, tileY, collected[i], {
        fontSize: '18px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      tileBoxes.push(box)
      tileTxts.push(txt)
    }

    const hint = this.add.text(width / 2, height * 0.76,
      '\u2190 \u2192 to move   ENTER / tap to select', {
      fontSize: '9px', fontFamily: FONT, color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    this.wordMenuObjects = [overlay, title, sub, wordDisplay, hint, ...slotBoxes, ...slotTexts, ...tileBoxes, ...tileTxts]

    let focusIdx = 0
    let progress = 0
    let shaking  = false
    const usedSet = new Set<number>()
    const keyListeners: { key: string; fn: () => void }[] = []

    const applyTileStyle = (i: number) => {
      if (usedSet.has(i)) {
        tileBoxes[i].setFillStyle(0x1a2a1a).setStrokeStyle(2, 0x336633)
        tileTxts[i].setColor('#336633')
      } else if (i === focusIdx) {
        tileBoxes[i].setFillStyle(0x2a3d55).setStrokeStyle(3, 0xffe066)
        tileTxts[i].setColor('#ffe066')
      } else {
        tileBoxes[i].setFillStyle(0x223344).setStrokeStyle(2, 0x556677)
        tileTxts[i].setColor('#ffffff')
      }
    }

    const moveFocus = (idx: number) => {
      if (shaking) return
      const prev = focusIdx
      focusIdx = idx       // update BEFORE applyTileStyle so the condition i===focusIdx is correct
      applyTileStyle(prev) // de-highlights old tile (prev !== focusIdx → normal style)
      applyTileStyle(idx)  // highlights new tile
    }

    const closeMenu = () => {
      this.wordMenuObjects.forEach(o => { if (o.active) (o as Phaser.GameObjects.Image).destroy() })
      this.wordMenuObjects = []
      this.wordMenuNav = null
      keyListeners.forEach(({ key, fn }) => this.input.keyboard?.off(key, fn))
      this.gm.resume()
      this.physics.world.isPaused = false
    }

    const shake = () => {
      if (shaking) return
      shaking = true
      this.tweens.add({
        targets: [...tileBoxes, ...tileTxts, ...slotBoxes, ...slotTexts],
        x: '+=7', duration: 35, yoyo: true, repeat: 4, ease: 'Linear',
        onComplete: () => { shaking = false; applyTileStyle(focusIdx) },
      })
    }

    const pick = (i: number) => {
      if (shaking || usedSet.has(i)) return
      const letter = collected[i]
      if (letter === targetWord[progress]) {
        usedSet.add(i)
        applyTileStyle(i)
        slotBoxes[progress].setFillStyle(0x1a3a1a).setStrokeStyle(2, 0x44cc44)
        slotTexts[progress].setText(letter).setColor('#44cc44')
        progress++
        if (progress === N) {
          this.time.delayedCall(300, () => {
            closeMenu()
            onCorrect()
            this.showPopup(jarX, jarY, 'MAGIC WORD!', '#ffe066')
            SoundManager.collectAbility()
          })
        } else {
          for (let s = 1; s <= M; s++) {
            const c = (focusIdx + s) % M
            if (!usedSet.has(c)) { moveFocus(c); break }
          }
        }
      } else {
        tileBoxes[i].setFillStyle(0x440000).setStrokeStyle(2, 0xff4444)
        tileTxts[i].setColor('#ff4444')
        shake()
        this.time.delayedCall(350, () => { if (!usedSet.has(i)) applyTileStyle(i) })
      }
    }

    tileBoxes.forEach((box, i) => {
      box.on('pointerover', () => { if (!shaking && !usedSet.has(i)) moveFocus(i) })
      box.on('pointerdown', () => pick(i))
    })

    moveFocus(0)

    const onLeft  = () => { if (!shaking) moveFocus((focusIdx - 1 + M) % M) }
    const onRight = () => { if (!shaking) moveFocus((focusIdx + 1) % M) }
    const onEnter = () => pick(focusIdx)

    keyListeners.push(
      { key: 'keydown-LEFT',  fn: onLeft  },
      { key: 'keydown-RIGHT', fn: onRight },
      { key: 'keydown-UP',    fn: onLeft  },
      { key: 'keydown-DOWN',  fn: onRight },
      { key: 'keydown-A',     fn: onLeft  },
      { key: 'keydown-D',     fn: onRight },
      { key: 'keydown-W',     fn: onLeft  },
      { key: 'keydown-S',     fn: onRight },
      { key: 'keydown-ENTER', fn: onEnter },
      { key: 'keydown-SPACE', fn: onEnter },
    )
    keyListeners.forEach(({ key, fn }) => this.input.keyboard?.on(key, fn))

    this.wordMenuNav = { up: onLeft, down: onRight, left: onLeft, right: onRight, confirm: onEnter }
  }

    private spawnKeyDrop(x: number, y: number, keyLevel: number) {
    const dropY = y - 16
    const glow = this.add.circle(x, dropY, 22, 0xffffff, 0.55).setDepth(7)
    this.tweens.add({ targets: glow, alpha: 0.2, scaleX: 1.5, scaleY: 1.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const img = this.add.image(x, dropY, 'item-key').setDepth(8).setScale(1.5)
    img.setData('item', { type: 'key', x, y: dropY, keyLevel } as ItemSpawn)
    img.setData('ring', glow)
    this.tweens.add({ targets: img, y: dropY - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const parent = keyLevel === 1 ? 'dad' : 'mom'
    const bubble = this.showNpcBubble(x, dropY - 72, ['You did it!', 'Grab the magic key', `to save ${parent}!`], null)
    bubble.setDepth(10)
    img.setData('keyBubble', bubble)
    this.collectibleSprites.push(img)
  }

  private checkCeleryBoost() {
    if (this.celeryNpcX === null) return
    const past = this.players.some(p => p.isAlive && p.x > this.celeryNpcX! + 80)
    if (!past) return
    this.celeryNpcX = null
    this.players.forEach(p => {
      if (!p.invulnerabilityActive) p.applyInvulnerability(true)
      if (!p.speedBoostActive)      p.applySpeedBoost(true)
      if (!p.strengthBoostActive)   p.applyStrengthBoost(true)
    })
  }

  private spawnPizzaDrop(x: number, y: number) {
    const dropY = y - 16
    const img = this.add.image(x, dropY, 'item-pizza').setDepth(8).setDisplaySize(56, 56)
    img.setData('item', { type: 'pizza', x, y: dropY } as ItemSpawn)
    this.tweens.add({ targets: img, y: dropY - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.collectibleSprites.push(img)
    this.time.delayedCall(10000, () => {
      if (!img.active) return
      this.collectibleSprites = this.collectibleSprites.filter(s => s !== img)
      this.tweens.add({ targets: img, alpha: 0, duration: 800, onComplete: () => img.destroy() })
    })
  }

  private spawnHeartDrop(x: number, y: number) {
    const dropY = y - 16
    const img = this.add.image(x, dropY, 'item-heart').setDepth(8).setScale(1.2)
    img.setData('item', { type: 'heart', x, y: dropY } as ItemSpawn)
    this.tweens.add({ targets: img, y: dropY - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.collectibleSprites.push(img)
    this.time.delayedCall(10000, () => {
      if (!img.active) return
      this.collectibleSprites = this.collectibleSprites.filter(s => s !== img)
      this.tweens.add({ targets: img, alpha: 0, duration: 500, onComplete: () => { if (img.active) img.destroy() } })
    })
  }

  private spawnFurnitureDrop(x: number, y: number) {
    this.spawnHeartDrop(x, y)
  }

  private spawnRoomFurnitureRandom() {
    const W = this.cfg.worldWidth
    const FLOOR_Y = 672
    const pool = [AbilityType.None, AbilityType.None, AbilityType.Fire, AbilityType.Lightning, AbilityType.Ice]

    const numBookcases = Math.max(1, Math.floor(W / 600))
    for (let i = 0; i < numBookcases; i++) {
      const bx = Math.round(200 + i * ((W - 300) / numBookcases) + Phaser.Math.Between(-30, 30))
      this.spawnFurniturePiece('bookcase', bx, FLOOR_Y - 40, AbilityType.None, 2)
    }
    const numTables = Math.max(1, Math.floor(W / 500))
    for (let i = 0; i < numTables; i++) {
      const tx = Math.round(280 + i * ((W - 400) / numTables) + Phaser.Math.Between(-20, 20))
      this.spawnFurniturePiece('table', tx, FLOOR_Y - 18, AbilityType.None, 1)
    }
    const numChests = Math.max(1, Math.floor(W / 700))
    for (let i = 0; i < numChests; i++) {
      const cx = Math.round(350 + i * ((W - 500) / numChests) + Phaser.Math.Between(-40, 40))
      this.spawnFurniturePiece('chest', cx, FLOOR_Y - 20, Phaser.Math.RND.pick(pool) as AbilityType, 3)
    }
  }

  // ── players ─────────────────────────────────────────────────────────────────

  private spawnPlayers() {
    const count: number  = this.registry.get('playerCount') ?? 1
    const remoteIds: number[] = this.registry.get('remotePlayers') ?? []
    const entryDir: ExitDir | null = this.registry.get('entryDir') ?? null
    const pos = entryDir ? getEntryPos(entryDir, this.cfg) : (this.cfg.defaultSpawn ?? { x: 800, y: 620 })

    for (let i = 0; i < count; i++) {
      const p = new Player(this, pos.x + i * 60, pos.y, i)
      p.setDepth(3)  // above background door (depth 1) so player stands in front
      this.players.push(p)

      const isLocalPlayer = !remoteIds.includes(i)
      if (isLocalPlayer) {
        const kbSlot = remoteIds.length > 0 ? 0 : i
        const kc = KEYBOARD_CONFIGS[kbSlot]
        if (kc && this.input.keyboard) {
          this.playerKeysets.set(i,
            Object.fromEntries(
              Object.entries(kc).map(([act, key]) => [act, this.input.keyboard!.addKey(key)]),
            ),
          )
        }
        if (i === this.localPlayerId && !this.touchControls && this.sys.game.device.input.touch) {
          this.touchControls = new TouchControls(this)
        }
      }

      const shieldGfx = this.add.graphics().setDepth(4)
      this.shieldGraphics.push(shieldGfx)

      p.on('died', () => this.onPlayerDied(p))
      p.on('useMelee', (src: Player) => this.doMeleeSwing(src))
      p.on('useCharacterAbility', (src: Player) => this.handleCharacterAbility(src))
      p.on('heartLost', () => {
        this.registry.set('hitsTaken', (this.registry.get('hitsTaken') ?? 0) + 1)
      })
    }
  }

  private useBackPortal() {
    const ri: number = this.registry.get('runIndex') ?? 0
    if (ri <= 0 || this.roomTransitioning) return
    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.registry.set('score', this.score)
    this.registry.set('persistedHearts',    this.players.map(pl => pl.hearts))
    this.registry.set('persistedBoosts',    this.players.map(pl => ({ speedBoostActive: pl.speedBoostActive, strengthBoostActive: pl.strengthBoostActive, invulnerabilityActive: pl.invulnerabilityActive, isTruck: pl.isTruck, isTrex: pl.isTrex, hasShadow: pl.isShadowForm })))
    this.registry.set('runIndex', ri - 1)
    this.registry.set('entryDir', this.cfg.backPortalEntryDir ?? 'right')
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private buildBackPortal() {
    if (!this.cfg.backPortal) return
    const { x, y } = this.cfg.backPortal
    const cy = y - 106

    const arch = this.add.graphics().setDepth(2)
    arch.fillStyle(0x2a1a0e, 1)
    arch.fillRoundedRect(x - 84, cy - 138, 168, 278, { tl: 72, tr: 72, bl: 0, br: 0 })
    arch.fillStyle(0x150903, 1)
    arch.fillRoundedRect(x - 74, cy - 130, 148, 264, { tl: 62, tr: 62, bl: 0, br: 0 })
    this.add.rectangle(x, cy - 132, 22, 20, 0x3d2812).setDepth(2)
    this.add.rectangle(x, cy - 132, 12, 12, 0x5a3c1e, 0.75).setDepth(2)

    const panelTop = cy - 68
    const panelBot = cy + 134
    const panelH   = panelBot - panelTop
    const wp = this.add.graphics().setDepth(2)
    wp.fillStyle(0x6b3e1c, 1)
    wp.fillRect(x - 72, panelTop, 70, panelH)
    wp.fillStyle(0x6b3e1c, 1)
    wp.fillRect(x + 2, panelTop, 70, panelH)
    for (let row = 4; row < panelH; row += 10) {
      const prominent = row % 30 === 0
      wp.fillStyle(prominent ? 0x3d2010 : 0x4e2c14, prominent ? 0.55 : 0.25)
      wp.fillRect(x - 72, panelTop + row, 70, prominent ? 3 : 2)
      wp.fillRect(x + 2,  panelTop + row, 70, prominent ? 3 : 2)
    }
    wp.fillStyle(0x8a5530, 0.30)
    wp.fillRect(x - 72, panelTop, 4, panelH)
    wp.fillRect(x + 68, panelTop, 4, panelH)
    this.add.rectangle(x, panelTop + panelH / 2, 4, panelH, 0x120804).setDepth(2)

    const bandYs = [cy - 30, cy + 40, cy + 100]
    bandYs.forEach(by => {
      this.add.rectangle(x, by,     140, 7, 0x252525).setDepth(2)
      this.add.rectangle(x, by - 1, 140, 3, 0x3c3c3c, 0.50).setDepth(2)
      ;[x - 56, x - 28, x + 2, x + 30, x + 58].forEach(rx => {
        this.add.circle(rx, by, 3, 0x2e2e2e).setDepth(2)
        this.add.circle(rx, by, 1, 0x4c4c4c).setDepth(2)
      })
    })

    ;[-30, 30].forEach(ox => {
      this.add.circle(x + ox, cy + 38, 8, 0x8a6830).setDepth(2)
      this.add.circle(x + ox, cy + 38, 5, 0x241508).setDepth(2)
      this.add.circle(x + ox, cy + 46, 4, 0x8a6830).setDepth(2)
    })

    this.backPortalLbl = this.add.text(x, cy - 158, '↑ RETURN', {
      fontSize: '9px', fontFamily: FONT, color: '#000000',
    }).setOrigin(0.5).setDepth(11).setVisible(false)
    this.backPortalPos = this.cfg.backPortal
  }

  private buildHiddenPortal() {
    if (!this.cfg.hiddenPortal) return
    this.hiddenPortalPos = this.cfg.hiddenPortal
  }

  private useHiddenPortal() {
    const ri: number = this.registry.get('runIndex') ?? 0
    if (this.roomTransitioning) return
    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.registry.set('score', this.score)
    this.registry.set('persistedHearts',    this.players.map(pl => pl.hearts))
    this.registry.set('persistedBoosts',    this.players.map(pl => ({ speedBoostActive: pl.speedBoostActive, strengthBoostActive: pl.strengthBoostActive, invulnerabilityActive: pl.invulnerabilityActive, isTruck: pl.isTruck, isTrex: pl.isTrex, hasShadow: pl.isShadowForm })))
    this.registry.set('runIndex', ri + 1)
    this.registry.set('entryDir', 'left')
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private wirePlayerUIEvents() {
    const persistedHearts: number[] | null = this.registry.get('persistedHearts')
    if (persistedHearts) {
      this.players.forEach((p, i) => {
        if (typeof persistedHearts[i] === 'number') {
          p.hearts = persistedHearts[i]
        }
      })
    }

    // Mom & dad's granted powers expire at the outdoor level — strip boosts but keep transforms
    if (this.cfg.isOutdoor) {
      type PB = { isTruck?: boolean; isTrex?: boolean; hasShadow?: boolean }
      const prev = this.registry.get('persistedBoosts') as PB[] | null
      this.registry.set('persistedBoosts', prev
        ? prev.map(pb => ({ speedBoostActive: false, strengthBoostActive: false, invulnerabilityActive: false, isTruck: pb?.isTruck ?? false, isTrex: pb?.isTrex ?? false, hasShadow: pb?.hasShadow ?? false }))
        : null)
    }

    type PersistedBoost = { speedBoostActive: boolean; strengthBoostActive: boolean; invulnerabilityActive?: boolean; isTruck?: boolean; isTrex?: boolean; hasShadow?: boolean }
    const persistedBoosts: PersistedBoost[] | null = this.registry.get('persistedBoosts')
    if (persistedBoosts) {
      this.players.forEach((p, i) => {
        const pb = persistedBoosts[i]
        if (pb?.speedBoostActive)      p.applySpeedBoost(true)
        if (pb?.strengthBoostActive)   p.applyStrengthBoost(true)
        if (pb?.invulnerabilityActive) p.applyInvulnerability(true)
        if (pb?.isTruck && p.charKey === 'eric') {
          p.isTruck = true
          p.setTexture('sheet-eric-transformer', 12)
          p.play('eric-anim-truck-idle', true)
        }
        if (pb?.isTrex && p.charKey === 'scarlett') {
          p.isTrex = true
          p.setTexture('sheet-trex', 0)
          p.play('trex-idle', true)
        }
        if (pb?.hasShadow && p.charKey === 'coco') {
          p.isShadowForm = true
          p.play('coco-shadow-idle', true)
        }
      })
    }
  }

  private removeRemotePlayer(id: number) {
    const idx = this.players.findIndex(p => p.playerId === id)
    if (idx === -1) return
    const p = this.players[idx]
    p.destroy()
    this.players.splice(idx, 1)
    this.playerKeysets.delete(id)
    this.remoteInputs.delete(id)
    this.registry.set('playerCount', this.players.length)
    if (this.players.length === 0) this.time.delayedCall(500, () => this.gameOver())
  }

  // ── tilemap static bodies ───────────────────────────────────────────────────

  // Scans a tile layer and adds one Arcade static body per horizontal run of
  // solid tiles. This reliably stops players/enemies regardless of whether
  // Phaser's internal tilemap physics fires correctly.
  private addTileLayerBodies(
    layer: Phaser.Tilemaps.TilemapLayer,
    scale: number,
    ox: number,
    oy: number,
  ) {
    const tw = Math.round(layer.tilemap.tileWidth  * scale)
    const th = Math.round(layer.tilemap.tileHeight * scale)
    const cols = layer.layer.width
    const rows = layer.layer.height

    for (let r = 0; r < rows; r++) {
      let runStart = -1

      for (let c = 0; c <= cols; c++) {
        const tile   = c < cols ? layer.getTileAt(c, r) : null
        const solid  = tile !== null && tile.index >= 0

        if (solid && runStart === -1) {
          runStart = c
        } else if (!solid && runStart !== -1) {
          const runLen = c - runStart
          const wx = ox + runStart * tw + (runLen * tw) / 2
          const wy = oy + r * th + th / 2
          const zone = this.add.zone(wx, wy, runLen * tw, th)
          this.physics.add.existing(zone, true)
          this.platforms.add(zone as unknown as Phaser.Physics.Arcade.Image)
          runStart = -1
        }
      }
    }
  }

  // ── collision ───────────────────────────────────────────────────────────────

  private setupCollision() {
    this.players.forEach(p => this.physics.add.collider(p, this.platforms))

    // Breakable blocks — players and non-flying enemies stand on them
    this.players.forEach(p => this.destructibles.forEach(d => this.physics.add.collider(p, d)))
    this.enemies.forEach(e => { if (!e.flying) this.destructibles.forEach(d => this.physics.add.collider(e, d)) })

    this.crates.forEach(c => this.physics.add.collider(c, this.platforms))
    for (let i = 0; i < this.crates.length; i++)
      for (let j = i + 1; j < this.crates.length; j++)
        this.physics.add.collider(this.crates[i], this.crates[j])

    for (let i = 0; i < this.players.length; i++)
      for (let j = i + 1; j < this.players.length; j++)
        this.physics.add.collider(this.players[i], this.players[j])

    // Tilemap layer colliders (worldMap mode)
    this.tilemapLayers.forEach(layer => {
      this.players.forEach(p => this.physics.add.collider(p, layer))
      this.enemies.forEach(e => { this.physics.add.collider(e, layer) })
      this.crates.forEach(c => this.physics.add.collider(c, layer))
      if (this.boss) this.physics.add.collider(this.boss, layer)
    })

    // Per-enemy platform colliders — flying enemies are excluded
    this.enemies.forEach(e => {
      if (!e.flying) this.physics.add.collider(e, this.platforms)
    })

    // Player ↔ enemy: truck runs them over (3× dmg = instant kill), otherwise player takes damage
    this.players.forEach(p => {
      this.physics.add.collider(p, this.enemyGroup, (_p, _e) => {
        const player = _p as Player
        const enemy  = _e as Enemy
        if (player.isTruck || player.isTrex || player.isSpindashing || player.getData('abbySpinHold') || this.cocoIsOnAttackFrame(player)) {
          enemy.die()
          this.addScore(SCORE_ENEMY)
          this.trackEnemyKill()
        } else {
          player.hitByEnemy()
        }
      })
    })

    // Boss colliders (separate from enemy group)
    if (this.boss) {
      this.physics.add.collider(this.boss, this.platforms)
      this.players.forEach(p => {
        this.physics.add.overlap(p, this.boss!, (_p, _b) => {
          if (this.cfg.bossNoAttack) return
          const player = _p as Player
          const boss   = _b as unknown as Boss
          if (Math.abs(player.y - boss.y) > 350) return
          if (player.isTruck || player.isTrex || player.isSpindashing || this.cocoIsOnAttackFrame(player)) this.hitBoss(player)
          else player.hitByEnemy()
        })
      })
    }

    // Spike balls — bounce off world geometry, block players and deal damage on contact
    this.spikeBalls.forEach(ball => {
      this.physics.add.collider(ball, this.platforms)
      this.tilemapLayers.forEach(l => this.physics.add.collider(ball, l))
      this.players.forEach(p => {
        this.physics.add.collider(p, ball, () => { p.hitByEnemy() })
      })
    })

    // Floor spikes — static, damage on contact
    this.spikeFloorTiles.forEach(spike => {
      this.players.forEach(p => {
        this.physics.add.overlap(p, spike, () => { p.hitByEnemy() })
      })
    })

    this.physics.add.overlap(this.projectiles, this.platforms, (proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
    })

    // Enemy projectiles hit players
    this.players.forEach(p => {
      this.physics.add.overlap(p, this.enemyProjectiles, (_p, proj) => {
        ;(proj as Phaser.Physics.Arcade.Image).destroy()
        ;(_p as Player).hitByEnemy()
      })
    })
    this.physics.add.overlap(this.enemyProjectiles, this.platforms, (proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
    })
  }

  // ── abilities ───────────────────────────────────────────────────────────────

  private doMeleeSwing(src: Player) {
    SoundManager.meleeSwing()
    const dir = src.flipX ? -1 : 1
    const RANGE = 90, HEIGHT = 70

    // Slash arc — sweeps from above to below the attack point
    const cx = src.x + dir * 48, cy = src.y
    const r = 52
    const startAngle = dir > 0 ? -0.9 : Math.PI + 0.9
    const endAngle   = dir > 0 ?  0.9 : Math.PI - 0.9
    const gfx = this.add.graphics().setDepth(12)
    gfx.lineStyle(5, 0xffffff, 0.95)
    gfx.beginPath()
    gfx.arc(cx, cy, r, startAngle, endAngle, dir < 0)
    gfx.strokePath()

    // Speed lines radiating from the arc midpoint
    const midAngle = (startAngle + endAngle) / 2
    for (let i = 0; i < 5; i++) {
      const a = midAngle + (i - 2) * 0.22
      const x1 = cx + Math.cos(a) * (r - 6)
      const y1 = cy + Math.sin(a) * (r - 6)
      const x2 = cx + Math.cos(a) * (r + 14 + i * 4)
      const y2 = cy + Math.sin(a) * (r + 14 + i * 4)
      gfx.lineStyle(2, 0xffffff, 0.6 - i * 0.1)
      gfx.beginPath(); gfx.moveTo(x1, y1); gfx.lineTo(x2, y2); gfx.strokePath()
    }

    this.tweens.add({ targets: gfx, alpha: 0, duration: 200, onComplete: () => gfx.destroy() })

    // Damage fires as arc peaks — enemies knocked away, boss pushed back
    this.time.delayedCall(70, () => {
      if (!src.active) return
      this.enemies.forEach(e => {
        if (!e.active) return
        const dx = e.x - src.x, dy = Math.abs(e.y - src.y)
        if (dir * dx > 0 && dir * dx <= RANGE && dy <= HEIGHT) {
          this.hitEnemy(e, src)
          const eb = e.body as Phaser.Physics.Arcade.Body
          eb.setVelocityX(dir * 900)
          eb.setVelocityY(-420)
          e.stun(400)
        }
      })
      if (this.boss?.active) {
        const bb = this.boss.body as Phaser.Physics.Arcade.Body
        const dx = this.boss.x - src.x
        const dy = Math.abs(bb.center.y - src.y)
        if (dir * dx > 0 && dir * dx <= RANGE && dy <= HEIGHT) {
          this.hitBoss(src)
          bb.setVelocityX(dir * 300)
          bb.setVelocityY(-180)
        }
      }
      this.destructibles.forEach(d => {
        if (!d.active) return
        const dx = d.x - src.x, dy = Math.abs(d.y - src.y)
        if (dir * dx > 0 && dir * dx <= RANGE && dy <= HEIGHT) d.takeDamage(30, DamageType.Physical)
      })
    })
  }

  private trackEnemyKill() {
    this.registry.set('enemiesKilled', (this.registry.get('enemiesKilled') ?? 0) + 1)
  }

  private hitEnemy(e: Enemy, src: Player) {
    if (src.strengthBoostActive) e.die()
    else e.hit()
    this.addScore(SCORE_ENEMY)
    this.trackEnemyKill()
  }

  private hitBoss(src: Player) {
    if (!this.boss?.active) return
    if (this.cfg.bossDefeatedKey === 'celeryManDefeated') {
      if (!this.registry.get('dadSaved') || !this.registry.get('momSaved')) return
    }
    if (src.strengthBoostActive) {
      this.boss.emit('hpChanged', 0, this.boss.maxHp)
      this.boss.bossDie()
    } else {
      this.boss.hit()
    }
  }

  // ── Conrad army truck ability ─────────────────────────────────────────────────

  private spawnConradTruck(src: Player) {
    src.swingMelee()
    if (!this.textures.exists('sheet-army-truck')) return
    const truck = new ConradArmyTruck(this, src.x, src.y)
    truck.setFlipX(src.flipX)
    truck.setData('patrolDir', src.flipX ? -1 : 1)
    this.conradTrucks.push(truck)
    this.physics.add.collider(truck, this.platforms)
    this.tilemapLayers.forEach(l => this.physics.add.collider(truck, l))
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

      // Find nearest target within attack range
      let nearTarget: Phaser.GameObjects.Sprite | null = null
      let nearDist = RANGE

      for (const e of this.enemies) {
        if (!e.active) continue
        const d = Phaser.Math.Distance.Between(truck.x, truck.y, e.x, e.y)
        if (d < nearDist) { nearDist = d; nearTarget = e }
      }
      if (this.boss?.active) {
        const d = Phaser.Math.Distance.Between(truck.x, truck.y, this.boss.x, this.boss.y)
        if (d < nearDist) { nearDist = d; nearTarget = this.boss }
      }

      const now      = this.time.now
      const holdUntil: number = truck.getData('shootHold') ?? 0

      if (nearTarget) {
        // Enemy in range — stop, face them, shoot; lock in shoot state briefly to dampen oscillation
        body.setVelocityX(0)
        const wasAlreadyShooting = truck.isShooting
        truck.isShooting = true
        truck.setData('shootHold', now + 800)
        truck.setFlipX(nearTarget.x < truck.x)
        // Fire immediately the moment the truck stops rather than waiting for the timer
        if (!wasAlreadyShooting) this.fireConradTruckShot(truck)
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
    let target: Phaser.GameObjects.Sprite | null = null
    let best = ConradArmyTruck.attackRange

    for (const e of this.enemies) {
      if (!e.active) continue
      const d = Phaser.Math.Distance.Between(truck.x, truck.y, e.x, e.y)
      if (d < best) { best = d; target = e }
    }
    if (this.boss?.active) {
      const d = Phaser.Math.Distance.Between(truck.x, truck.y, this.boss.x, this.boss.y)
      if (d < best) { best = d; target = this.boss }
    }
    type TruckEffect = 'fire' | 'ice' | 'explode' | 'blackhole' | 'lightning'
    const effectType = Phaser.Math.RND.pick(['fire', 'ice', 'explode', 'blackhole', 'lightning'] as TruckEffect[])
    const frame = effectType === 'fire' ? 1 : effectType === 'ice' ? 2 : effectType === 'explode' ? 3 : effectType === 'blackhole' ? 7 : 9
    // If no target in range, fire horizontally in the direction the truck faces
    const angle = target
      ? Phaser.Math.Angle.Between(truck.x, truck.y - 10, target.x, target.y)
      : (truck.flipX ? Math.PI : 0)
    const proj = this.physics.add.image(truck.x, truck.y - 10, 'sheet-truck-projectiles', frame)
    proj.setScale(1.8).setRotation(angle)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * 680, Math.sin(angle) * 680)
      .setGravityY(-800)

    const onHit = (hx: number, hy: number) => {
      if (!proj.active) return
      this.triggerTruckBulletEffect(effectType, hx, hy)
      proj.destroy()
    }

    this.enemies.forEach(e => {
      this.physics.add.overlap(proj, e, () => { this.hitEnemy(e, this.players[0]); onHit(e.x, e.y) })
    })
    if (this.boss?.active) {
      this.physics.add.overlap(proj, this.boss, () => {
        if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
            (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
        SoundManager.bossHit()
        this.boss!.hit()
        onHit(this.boss!.x, this.boss!.y)
      })
    }
    // Delay surface colliders so the bullet escapes the truck's spawn tile first
    this.time.delayedCall(150, () => {
      if (!proj.active) return
      this.physics.add.collider(proj, this.platforms, () => onHit(proj.x, proj.y))
      this.tilemapLayers.forEach(l => this.physics.add.collider(proj, l, () => onHit(proj.x, proj.y)))
    })
    this.time.delayedCall(2200, () => { if (proj.active) onHit(proj.x, proj.y) })
  }

  private triggerTruckBulletEffect(type: 'fire' | 'ice' | 'explode' | 'blackhole' | 'lightning', x: number, y: number) {
    const src = this.players[0]

    if (type === 'explode') {
      const RADIUS = 110
      if (src) {
        this.enemies.forEach(e => {
          if (!e.active) return
          if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < RADIUS) this.hitEnemy(e, src)
        })
        if (this.boss?.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) < RADIUS) {
          SoundManager.bossHit(); this.boss.hit()
        }
      }
    } else if (type === 'blackhole') {
      const RADIUS = 180
      const pulled = this.enemies.filter(e => e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) < RADIUS)
      // Repeatedly override enemy velocity toward the impact point for ~600 ms
      for (let t = 0; t < 600; t += 60) {
        this.time.delayedCall(t, () => {
          pulled.forEach(e => {
            if (!e.active) return
            const ang = Phaser.Math.Angle.Between(e.x, e.y, x, y)
            ;(e.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * 520, Math.sin(ang) * 520)
          })
        })
      }
      if (src) {
        this.time.delayedCall(620, () => {
          pulled.forEach(e => { if (e.active) this.hitEnemy(e, src) })
          if (this.boss?.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) < RADIUS) {
            SoundManager.bossHit(); this.boss.hit()
          }
        })
      }
    } else if (type === 'lightning') {
      const RADIUS = 220
      const targets = this.enemies
        .filter(e => e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) < RADIUS)
        .sort((a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y))
        .slice(0, 3)
      if (src) targets.forEach(e => this.hitEnemy(e, src))
      if (this.boss?.active && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) < RADIUS) {
        SoundManager.bossHit(); this.boss.hit()
      }
      targets.forEach((e, i) => {
        this.time.delayedCall(i * 80, () => {
          if (!e.active) return
          const g = this.add.graphics().setDepth(15)
          g.lineStyle(3, 0xffff44, 1)
          g.strokeLineShape(new Phaser.Geom.Line(x, y, e.x, e.y))
          this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() })
        })
      })
    }

    const color  = type === 'fire' ? 0xff5500 : type === 'ice' ? 0x22ddff : type === 'explode' ? 0xffee00
                 : type === 'blackhole' ? 0x220033 : 0xffff44
    const radius = type === 'explode' ? 55 : type === 'blackhole' ? 65 : 18
    const flash  = this.add.circle(x, y, radius, color, 0.9).setDepth(15)

    if (type === 'blackhole') {
      this.tweens.add({
        targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0.4, duration: 300,
        onComplete: () => {
          this.tweens.add({ targets: flash, scaleX: 0, scaleY: 0, alpha: 0, duration: 350,
            onComplete: () => { if (flash.active) flash.destroy() } })
        },
      })
    } else {
      this.tweens.add({
        targets: flash,
        scaleX: type === 'explode' ? 4 : 2.5, scaleY: type === 'explode' ? 4 : 2.5,
        alpha: 0,
        duration: type === 'explode' ? 420 : 240,
        onComplete: () => { if (flash.active) flash.destroy() },
      })
    }
  }

  // ── Coco shadow ability ───────────────────────────────────────────────────────

  private handleCocoShadow(coco: Player) {
    if (!coco.isShadowForm) {
      this.transformCocoIn(coco)
    } else if (!coco.isSpindashing && this.cocoSpindashState === 'none') {
      // Only exit if DOWN is not held (DOWN+ability starts spindash instead)
      const keys = this.playerKeysets.get(coco.playerId)
      const pad  = this.input.gamepad?.getPad(this.nm ? 0 : coco.playerId)
      const downHeld = (keys?.['down']?.isDown ?? false) ||
                       (pad?.connected ? !!(pad.down || pad.buttons[13]?.pressed) : false)
      if (!downHeld) this.transformCocoOut(coco)
    }
  }

  // ── Coco Shadow-form transform ────────────────────────────────────────────────

  private transformCocoIn(coco: Player) {
    if (coco.isShadowForm || coco.isTransforming) return
    coco.isTransforming = true
    coco.play('coco-transform-in', true)
    coco.once('animationcomplete-coco-transform-in', () => {
      if (!coco.active) return
      coco.isShadowForm  = true
      coco.isTransforming = false
      this.cocoSpindashState = 'none'
      coco.play('coco-shadow-idle', true)
    })
  }

  private transformCocoOut(coco: Player) {
    if (!coco.isShadowForm || coco.isTransforming || coco.isSpindashing) return
    this.stopCocoSpin(coco)
    coco.isTransforming = true
    coco.play('coco-transform-out', true)
    coco.once('animationcomplete-coco-transform-out', () => {
      if (!coco.active) return
      coco.isShadowForm   = false
      coco.isSpindashing  = false
      coco.isTransforming = false
      this.cocoSpindashState = 'none'
      coco.play(`char-${coco.charKey}-idle`, true)
    })
  }

  // ── Spindash helpers ──────────────────────────────────────────────────────────

  private startCocoSpin(coco: Player, fast: boolean) {
    this.cocoSpinTween?.stop()
    this.cocoSpinTween = this.tweens.add({
      targets: coco, angle: coco.flipX ? -360 : 360,
      duration: fast ? 160 : 340, repeat: -1,
    })
  }

  private stopCocoSpin(coco: Player) {
    this.cocoSpinTween?.stop()
    this.cocoSpinTween = null
    coco.setAngle(0)
  }

  private enterCocoSpindash(coco: Player) {
    if (this.cocoSpindashState !== 'none') return
    this.cocoSpindashState = 'windup'
    coco.isSpindashing = true
    this.cocoDashHitDestructibles.clear()
    coco.play('coco-spindash-windup', true)
    coco.once('animationcomplete-coco-spindash-windup', () => {
      if (!coco.active) return
      this.cocoSpindashState = 'dashing'
      coco.play('coco-spindash-dash', true)
      this.startCocoSpin(coco, true)
    })
  }

  private endCocoSpindash(coco: Player) {
    if (this.cocoSpindashState !== 'dashing') return
    this.cocoSpindashState = 'exit'
    this.stopCocoSpin(coco)
    coco.play('coco-spindash-exit', true)
    coco.once('animationcomplete-coco-spindash-exit', () => {
      if (!coco.active) return
      this.cocoSpindashState = 'none'
      coco.isSpindashing = false
      coco.play('coco-shadow-idle', true)
    })
  }

  private updateCocoShadow() {
    const coco = this.players.find(p => p.charKey === 'coco' && p.isAlive)
    if (!coco?.isShadowForm) return
    if (coco.isTransforming) return   // transform animation in progress — don't override it

    const body = coco.body as Phaser.Physics.Arcade.Body
    const keys = this.playerKeysets.get(coco.playerId)
    const pad  = this.input.gamepad?.getPad(this.nm ? 0 : coco.playerId)

    const downHeld    = (keys?.['down']?.isDown    ?? false) || (pad?.connected ? !!(pad.down    || pad.buttons[13]?.pressed) : false)
    const abilityHeld = (keys?.['ability']?.isDown ?? false) || (pad?.connected ? !!(pad.buttons[1]?.pressed) : false)

    switch (this.cocoSpindashState) {
      case 'none': {
        const airborne = !body.blocked.down
        if (airborne && body.velocity.y < -60) {
          if (coco.anims.currentAnim?.key !== 'coco-shadow-jump') coco.play('coco-shadow-jump', true)
        } else if (airborne) {
          if (coco.anims.currentAnim?.key !== 'coco-shadow-fall') coco.play('coco-shadow-fall', true)
        } else {
          if (this.cocoSpinTween) this.stopCocoSpin(coco)
          const animKey = Math.abs(body.velocity.x) > 10 ? 'coco-shadow-walk' : 'coco-shadow-idle'
          if (coco.anims.currentAnim?.key !== animKey) coco.play(animKey, true)
        }
        // Only spin on spindash frames 9-12
        if (airborne) {
          const frameNum = coco.anims.currentFrame?.textureFrame as number ?? -1
          if (frameNum >= 9 && frameNum <= 12) {
            if (!this.cocoSpinTween) this.startCocoSpin(coco, false)
          } else {
            if (this.cocoSpinTween) this.stopCocoSpin(coco)
          }
        }
        // DOWN + ABILITY held while grounded → start windup then dash
        if (downHeld && abilityHeld && body.blocked.down) this.enterCocoSpindash(coco)
        break
      }

      case 'windup':
        break  // animation auto-transitions to 'dashing' on complete

      case 'dashing': {
        // Release ability → exit (wall hits no longer end the dash)
        if (!abilityHeld) { this.endCocoSpindash(coco); break }

        // Amplify horizontal movement to 3× speed
        if (Math.abs(body.velocity.x) > 10)
          body.setVelocityX(Math.sign(body.velocity.x) * 1050)

        // Enemy + boss damage handled by the physics collider in setupCollision (isSpindashing flag).
        // Destroy nearby furniture/chests before the physics collider can stop the player.
        for (const d of this.destructibles) {
          if (!d.active || this.cocoDashHitDestructibles.has(d)) continue
          if (Phaser.Math.Distance.Between(coco.x, coco.y, d.x, d.y) < 72) {
            this.cocoDashHitDestructibles.add(d)
            d.takeDamage(100, DamageType.Physical)
          }
        }
        break
      }

      case 'exit':
        break  // animationcomplete handler in endCocoSpindash takes over
    }
  }

  private cocoIsOnAttackFrame(player: Player): boolean {
    if (player.charKey !== 'coco' || !player.isShadowForm) return false
    const frame = player.anims.currentFrame?.textureFrame
    return typeof frame === 'number' && frame >= 10 && frame <= 12
  }

  // ── Callum number ability ─────────────────────────────────────────────────────

  private spawnCallumNumber(src: Player) {
    // Don't stack if a line is already active
    if (this.callumNumbers.length > 0) return
    src.swingMelee()

    const COUNT   = 10
    const SPACING = 56
    // Spawn at foot level so numbers sit on the surface the player is standing on
    const lineY   = src.y + 28
    const startX  = src.x - ((COUNT - 1) * SPACING) / 2
    const palette = ['#ff6666','#ffdd44','#44ff88','#44ccff','#ff88ff',
                     '#ff9944','#aaffff','#ffffff','#ffaacc','#aaffaa']

    for (let i = 0; i < COUNT; i++) {
      const numX   = startX + i * SPACING
      const numVal = i + 1
      const color  = palette[i]

      const glow = this.add.text(numX, lineY, `${numVal}`, {
        fontSize: '46px', fontFamily: FONT, color: '#ffffff',
        stroke: '#ffffff', strokeThickness: 10,
      }).setOrigin(0.5).setDepth(11).setAlpha(0.40)
      glow.setTint(0xaa00ff, 0x0088ff, 0xff0077, 0xffaa00)
      this.tweens.add({ targets: glow, alpha: 0.12, duration: 600 + i * 60, yoyo: true, repeat: -1 })

      const num = this.add.text(numX, lineY, `${numVal}`, {
        fontSize: '42px', fontFamily: FONT, color,
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(12)

      this.physics.add.existing(num)
      const body = num.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setVelocity(0, 0)

      const emitter = this.add.particles(numX, lineY, '__DEFAULT', {
        lifespan: { min: 300, max: 600 },
        speed: { min: 10, max: 40 },
        scale: { start: 0.25, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffd700, 0xffffff, 0xccaaff, 0x88ddff],
        quantity: 1, frequency: 120, blendMode: 'ADD',
      }).setDepth(13)

      let didHit = false
      const cleanup = () => {
        if (!num.active) return
        emitter.destroy()
        if (glow.active) glow.destroy()
        this.tweens.add({
          targets: num, alpha: 0, scaleX: 1.5, scaleY: 1.5,
          duration: 160, onComplete: () => { if (num.active) num.destroy() },
        })
      }

      const onHit = (targetObj: Enemy | Boss) => {
        if (didHit || !num.active) return
        didHit = true
        if (targetObj === this.boss) {
          if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
              (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
          SoundManager.bossHit()
          this.boss!.hit()
        } else {
          SoundManager.enemyHit()
          ;(targetObj as Enemy).hit()
          this.addScore(SCORE_ENEMY)
        }
        cleanup()
      }

      // Phase 1 (3 s): numbers sit in line; any enemy walking into them takes a hit
      this.enemies.forEach(e => {
        if (e.active) this.physics.add.overlap(num, e, () => onHit(e))
      })
      if (this.boss?.active) {
        this.physics.add.overlap(num, this.boss, () => onHit(this.boss!))
      }

      // Phase 2: after 1.5 s, each number shoots toward nearest enemy
      this.time.delayedCall(1500, () => {
        if (!num.active || didHit) return
        body.setBounce(1, 1)
        body.setCollideWorldBounds(true)

        let target: Phaser.GameObjects.Sprite | null = null
        let best = Infinity
        for (const e of this.enemies) {
          if (!e.active) continue
          const d = Phaser.Math.Distance.Between(num.x, num.y, e.x, e.y)
          if (d < best) { best = d; target = e }
        }
        if (this.boss?.active) {
          const d = Phaser.Math.Distance.Between(num.x, num.y, this.boss.x, this.boss.y)
          if (d < best) { best = d; target = this.boss }
        }
        if (target) {
          const angle = Phaser.Math.Angle.Between(num.x, num.y, target.x, target.y)
          body.setVelocity(Math.cos(angle) * 680, Math.sin(angle) * 680)
        }
      })

      // Total lifetime cap: 7 s
      this.time.delayedCall(7000, () => {
        if (num.active && !didHit) cleanup()
      })

      this.callumNumbers.push({ obj: num, glow, emitter })
    }
  }

  private updateCallumNumbers() {
    this.callumNumbers = this.callumNumbers.filter(n => n.obj.active)
    for (const n of this.callumNumbers) {
      n.emitter.setPosition(n.obj.x, n.obj.y)
      if (n.glow.active) n.glow.setPosition(n.obj.x, n.obj.y)
    }
  }

  // ── Abby transform ability ───────────────────────────────────────────────────
  // Abby animates through abby_transform frames 1-9, with frames 8-11 rotating.
  // Holds on frame 10 for 5 seconds at 3× scale, instantly killing any enemy
  // that comes into contact. Then reforms through frames 11-15 at normal size.

  private handleAbbyTransform(src: Player) {
    if (src.isTransforming) return
    src.isTransforming = true
    src.stop()  // halt any currently playing animation before manual frame stepping

    const FRAME_MS  = 80    // ms per frame (~12.5 fps)
    const HOLD_MS   = 5000  // 5-second spiral hold on frame 10
    const KILL_R    = 96    // kill radius while at 3× scale (half of 64px frame × 3)
    const origScale = src.scale  // preserve player's default scale (1.3)

    src.setTexture('sheet-abby-transformer', 1)

    let rotTween: Phaser.Tweens.Tween | null = null

    const startRot = (dur: number) => {
      rotTween?.stop()
      rotTween = this.tweens.add({ targets: src, angle: '+=360', duration: dur, repeat: -1 })
    }

    // Frames 2-7: advance without rotation
    for (let f = 2; f <= 7; f++) {
      this.time.delayedCall((f - 1) * FRAME_MS, () => {
        if (!src.active) return
        src.setFrame(f)
      })
    }

    // Frame 8: rotation begins
    this.time.delayedCall(7 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(8)
      startRot(400)
    })

    // Frame 9
    this.time.delayedCall(8 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(9)
    })

    // Frame 10: enlarge 3×, raise 10px, hover (no gravity), spin, kill enemies + breakables
    this.time.delayedCall(9 * FRAME_MS, () => {
      if (!src.active) return
      src.setFrame(10)
      src.setScale(3)
      src.setY(src.y - 10)
      startRot(350)

      const body = src.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setVelocityY(0)
      src.setData('abbySpinHold', true)

      const hitSet         = new Set<Enemy>()
      const destroyedBreak = new Set<Destructible>()
      const killTimer = this.time.addEvent({
        delay: 20,
        loop: true,
        callback: () => {
          if (!src.active) return
          for (const e of this.enemies) {
            if (!e.active || hitSet.has(e)) continue
            if (Phaser.Math.Distance.Between(src.x, src.y, e.x, e.y) < KILL_R) {
              hitSet.add(e)
              e.die()
              this.addScore(SCORE_ENEMY)
            }
          }
          for (const d of this.destructibles) {
            if (!d.active || destroyedBreak.has(d)) continue
            if (Phaser.Math.Distance.Between(src.x, src.y, d.x, d.y) < KILL_R) {
              destroyedBreak.add(d)
              d.takeDamage(100, DamageType.Physical)
            }
          }
        },
      })

      let reformFired = false
      const doReform = () => {
        if (reformFired) return
        reformFired = true
        holdTimer.remove()
        killTimer.remove()
        body.setAllowGravity(true)
        src.setData('abbySpinHold', false)
        src.setData('abbyEarlyExit', null)

        if (!src.active) {
          rotTween?.stop()
          src.setY(src.y + 10)
          src.setScale(origScale)
          src.setAngle(0)
          src.isTransforming = false
          return
        }

        // Frame 11: restore gravity/position, scale back to normal, rotation continues
        src.setY(src.y + 10)
        src.setScale(origScale)
        src.setFrame(11)
        startRot(400)

        // After frame 11, stop rotation and play reform frames 12-15
        this.time.delayedCall(FRAME_MS, () => {
          rotTween?.stop()
          rotTween = null
          src.setAngle(0)

          const reformFrames = [12, 13, 14, 15]
          for (let i = 0; i < reformFrames.length; i++) {
            this.time.delayedCall(i * FRAME_MS, () => {
              if (src.active) src.setFrame(reformFrames[i])
            })
          }

          this.time.delayedCall(reformFrames.length * FRAME_MS, () => {
            src.setScale(origScale)
            src.setAngle(0)
            src.isTransforming = false
            // updateAnimation() resumes on next tick and restores sheet-abby
          })
        })
      }

      src.setData('abbyEarlyExit', doReform)
      const holdTimer = this.time.delayedCall(HOLD_MS, doReform)
    })
  }

  // ── Scarlett T-Rex transformation ────────────────────────────────────────────

  private transformScarlettToTrex(player: Player) {
    if (player.isTrex || player.isTransforming) return
    player.isTransforming = true
    player.setTexture('sheet-scarlett-transformer', 0)
    player.play('scarlett-anim-transform')
    player.once('animationcomplete-scarlett-anim-transform', () => {
      if (!player.active) return
      player.isTrex = true
      player.isTransforming = false
      player.setTexture('sheet-trex', 0)
      player.play('trex-idle', true)
    })
  }

  private untransformScarlett(player: Player) {
    if (!player.isTrex || player.isTransforming) return
    player.isTrex = false
    player.isTransforming = true
    player.setTexture('sheet-scarlett-transformer', 0)
    player.play('scarlett-anim-untransform')
    player.once('animationcomplete-scarlett-anim-untransform', () => {
      if (!player.active) return
      player.isTransforming = false
    })
  }

  // ── Carter duplicate ability ─────────────────────────────────────────────────

  private handleCharacterAbility(src: Player) {
    if (src.charKey === 'carter') this.spawnCarterDuplicate(src)
    else if (src.charKey === 'eric') {
      if (src.isTruck) this.untransformEric(src)
      else this.transformEricToTruck(src)
    }
    else if (src.charKey === 'conrad') this.spawnConradTruck(src)
    else if (src.charKey === 'coco') this.handleCocoShadow(src)
    else if (src.charKey === 'callum') this.spawnCallumNumber(src)
    else if (src.charKey === 'abby') {
      const earlyExit = src.getData('abbyEarlyExit') as (() => void) | null
      if (earlyExit) earlyExit()
      else this.handleAbbyTransform(src)
    }
    else if (src.charKey === 'scarlett') {
      if (src.isTrex) this.untransformScarlett(src)
      else this.transformScarlettToTrex(src)
    }
    else this.doMeleeSwing(src)
  }

  // ── Eric truck transformation ─────────────────────────────────────────────

  private transformEricToTruck(player: Player) {
    if (player.isTruck || player.isTransforming) return

    player.isTransforming = true
    player.setTexture('sheet-eric-transformer', 0)
    player.play('eric-anim-transform')

    player.once('animationcomplete-eric-anim-transform', () => {
      if (!player.active) return
      player.isTruck = true
      player.isTransforming = false
      player.play('eric-anim-truck-idle', true)
    })
  }

  private untransformEric(player: Player) {
    if (!player.isTruck || player.isTransforming) return

    player.isTruck = false
    player.isTransforming = true
    player.play('eric-anim-untransform')

    player.once('animationcomplete-eric-anim-untransform', () => {
      if (!player.active) return
      player.isTransforming = false
      // Releasing the lock lets updateAnimation() resume normal eric animations
      // on the next frame, which auto-switches back to sheet-eric via the anim frames
    })
  }

  private spawnCarterDuplicate(src: Player) {
    const sheet = `sheet-${src.charKey}`
    if (!this.textures.exists(sheet)) return
    const dup = new CarterDuplicate(this, src.x, src.y, sheet)
    dup.setFlipX(src.flipX)
    this.carterDuplicates.push(dup)
    this.physics.add.collider(dup, this.platforms)
    this.tilemapLayers.forEach(l => this.physics.add.collider(dup, l))
    this.enemies.forEach(e => {
      this.physics.add.overlap(dup, e, () => dup.hit())
    })
    if (this.boss?.active) {
      this.physics.add.overlap(dup, this.boss, () => dup.hit())
    }
    dup.on('fireLaser', (d: CarterDuplicate) => this.fireDuplicateLaser(d))
    dup.on('duplicateDied', (d: CarterDuplicate) => {
      this.carterDuplicates = this.carterDuplicates.filter(x => x !== d)
    })
  }

  private fireDuplicateLaser(dup: CarterDuplicate) {
    if (!dup.active) return

    // Find nearest target
    let target: Phaser.GameObjects.Sprite | null = null
    let best = 800   // max laser range

    for (const e of this.enemies) {
      if (!e.active) continue
      const d = Phaser.Math.Distance.Between(dup.x, dup.y, e.x, e.y)
      if (d < best) { best = d; target = e }
    }
    if (this.boss?.active) {
      const d = Phaser.Math.Distance.Between(dup.x, dup.y, this.boss.x, this.boss.y)
      if (d < best) { best = d; target = this.boss }
    }
    if (!target) return

    const tx = target.x
    const ty = target.y - 20
    const eyeX = dup.x + (dup.flipX ? -8 : 8)
    const eyeY = dup.y - 18

    const gfx = this.add.graphics().setDepth(15)
    gfx.lineStyle(6, 0xff2200, 0.85)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    gfx.lineStyle(12, 0xff6600, 0.3)
    gfx.lineBetween(eyeX, eyeY, tx, ty)
    this.tweens.add({ targets: gfx, alpha: 0, duration: 250, onComplete: () => gfx.destroy() })

    if (target === this.boss) {
      if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
          (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
      SoundManager.bossHit()
      this.boss!.hit()
    } else {
      this.hitEnemy(target as Enemy, this.players[0] ?? this.players[0])
    }
  }

  private fireCeleryStalk() {
    if (!this.boss?.active) return
    const bx = this.boss.x
    const by = this.boss.y
    const alive = this.players.filter(p => p.isAlive)
    if (alive.length === 0) return
    const target = alive.reduce((a, b) =>
      Math.abs(a.x - bx) < Math.abs(b.x - bx) ? a : b)
    const angle = Phaser.Math.Angle.Between(bx, by, target.x, target.y)
    const speed = 500
    const texKey = this.textures.exists('proj-fire') ? 'proj-fire' : 'fireball'
    const proj = this.physics.add.image(bx, by, texKey)
    proj.setTint(0x22cc55).setScale(0.7, 1.8)
    this.enemyProjectiles.add(proj)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      .setGravityY(-800)
    proj.setAngle(Phaser.Math.RadToDeg(angle))
    this.time.delayedCall(2500, () => { if (proj.active) proj.destroy() })
  }

  private fireBossSpecial(ability: AbilityType) {
    if (!this.boss?.active) return

    // Celery man: rapid single stalk aimed at nearest player
    if (this.cfg.bossKey === 'sheet-celery') {
      this.fireCeleryStalk()
      return
    }

    const bx = this.boss.x
    const by = this.boss.y

    const alive = this.players.filter(p => p.isAlive)
    if (alive.length === 0) return
    const target = alive.reduce((a, b) =>
      Math.abs(a.x - bx) < Math.abs(b.x - bx) ? a : b)

    switch (ability) {

      case AbilityType.Fire: {
        // Fan of 5 fireballs aimed at the nearest player
        this.cameras.main.flash(80, 255, 80, 0, false)
        const baseAngle = Phaser.Math.Angle.Between(bx, by, target.x, target.y)
        const speed = 380
        const fireTexKey = this.textures.exists('proj-fire') ? 'proj-fire' : 'fireball'
        const offsets = [-0.5, -0.25, 0, 0.25, 0.5]
        offsets.forEach(offset => {
          const a = baseAngle + offset
          const proj = this.physics.add.image(bx, by + 20, fireTexKey)
          this.enemyProjectiles.add(proj)
          ;(proj.body as Phaser.Physics.Arcade.Body)
            .setVelocity(Math.cos(a) * speed, Math.sin(a) * speed)
            .setGravityY(-800)
          if (fireTexKey === 'fireball') proj.setTint(0xff4400).setScale(1.5)
          proj.setAngle(Phaser.Math.RadToDeg(a))
          this.tweens.add({ targets: proj, angle: proj.angle + 360, duration: 450, repeat: -1 })
          this.time.delayedCall(2600, () => { if (proj.active) proj.destroy() })
        })
        break
      }

      case AbilityType.Ice: {
        // 5 icicles falling straight down at positions spread around the player
        this.cameras.main.flash(80, 80, 160, 255, false)
        const iceTexKey = this.textures.exists('proj-ice') ? 'proj-ice' : 'fireball'
        for (let i = 0; i < 5; i++) {
          const spreadX = target.x + (i - 2) * 130
          const proj = this.physics.add.image(spreadX, by, iceTexKey)
          this.enemyProjectiles.add(proj)
          ;(proj.body as Phaser.Physics.Arcade.Body)
            .setVelocity(0, 440)
            .setGravityY(-800)
          if (iceTexKey === 'fireball') proj.setTint(0x66ccff).setScale(1.2)
          proj.setAngle(90)
          this.tweens.add({ targets: proj, angle: proj.angle + 360, duration: 600, repeat: -1 })
          this.time.delayedCall(3000, () => { if (proj.active) proj.destroy() })
        }
        break
      }

      case AbilityType.Lightning: {
        // Diagonal lightning bolt from boss to nearest player
        const dx = target.x - bx, dy = target.y - by
        const boltLen = Math.sqrt(dx * dx + dy * dy)
        const angle   = Math.atan2(dy, dx)
        const midX = bx + dx / 2, midY = by + dy / 2

        this.cameras.main.flash(100, 255, 240, 80, false)
        const bolt = this.add.rectangle(midX, midY, boltLen, 10, 0xffee00, 0.95)
          .setRotation(angle).setDepth(15)
        const glow = this.add.rectangle(midX, midY, boltLen, 30, 0xffee00, 0.25)
          .setRotation(angle).setDepth(14)
        this.tweens.add({
          targets: [bolt, glow], alpha: 0, scaleY: 2, duration: 350,
          onComplete: () => { bolt.destroy(); glow.destroy() },
        })

        // Damage players close to the bolt line
        this.players.forEach(p => {
          if (!p.isAlive) return
          // Point-to-segment distance check
          const t = Math.max(0, Math.min(1, ((p.x - bx) * dx + (p.y - by) * dy) / (boltLen * boltLen)))
          const nearX = bx + t * dx, nearY = by + t * dy
          if (Math.sqrt((p.x - nearX) ** 2 + (p.y - nearY) ** 2) < 60) p.hitByEnemy()
        })
        break
      }
    }
  }

  private spawnEnemyProjectile(enemy: Enemy) {
    const alive = this.players.filter(p => p.isAlive)
    if (alive.length === 0) return
    const target = alive.reduce((a, b) =>
      Math.abs(a.x - enemy.x) < Math.abs(b.x - enemy.x) ? a : b)
    const dir = target.x > enemy.x ? 1 : -1
    const speed = 320

    let gy = -800
    if (enemy.abilityType === AbilityType.Ice)      gy = 0
    if (enemy.abilityType === AbilityType.Lightning) gy = -200

    const isIce  = enemy.abilityType === AbilityType.Ice
    const isFire = enemy.abilityType === AbilityType.Fire || enemy.abilityType === AbilityType.BlackDragon
    const texKey = isFire && this.textures.exists('proj-fire') ? 'proj-fire'
                 : isIce  && this.textures.exists('proj-ice')  ? 'proj-ice'
                 : 'fireball'

    const proj = this.physics.add.image(enemy.x + dir * 20, enemy.y, texKey)
    this.enemyProjectiles.add(proj)
    const body = proj.body as Phaser.Physics.Arcade.Body
    body.setVelocityX(dir * speed).setGravityY(gy)

    if (texKey === 'fireball') {
      if (isIce)  proj.setTint(0x66ccff)
      if (enemy.abilityType === AbilityType.Lightning) proj.setTint(0xffdd00).setScale(1.4)
    }
    if (isFire || isIce) {
      proj.setFlipX(dir < 0)
      this.tweens.add({ targets: proj, angle: proj.angle + 360, duration: isFire ? 450 : 600, repeat: -1 })
    }

    this.time.delayedCall(2400, () => { if (proj.active) proj.destroy() })
  }

  private spawnAbilityDrop(x: number, y: number, _ability: AbilityType) {
    const orb = this.physics.add.image(x, y - 10, 'warp-star').setScale(0.35)
    ;(orb.body as Phaser.Physics.Arcade.Body).setVelocityY(-200)
    this.tweens.add({ targets: orb, alpha: 0, duration: 2000,
      onComplete: () => { if (orb.active) orb.destroy() } })
  }


  // ── camera ──────────────────────────────────────────────────────────────────

  private setupCamera() {
    this.cameraTarget = this.add.rectangle(0, 0, 1, 1).setVisible(false)
    this.cameras.main.startFollow(this.cameraTarget, true, 0.08, 0.08)
  }

  // ── score / lives ────────────────────────────────────────────────────────────

  private addScore(pts: number) {
    this.score += pts
    this.registry.set('score', this.score)
  }

  private onPlayerDied(p: Player) {
    let lives: number = this.registry.get('lives') ?? 1
    lives--
    this.registry.set('lives', lives)

    if (lives <= 0) {
      this.time.delayedCall(800, () => this.gameOver())
      return
    }

    this.time.delayedCall(1500, () => {
      if (!p.active) return
      p.hearts = 3
      p.isAlive = true
      p.setAlpha(1)
      p.clearTint()
      p.setPosition(this.cameras.main.scrollX + 200, 620)
      ;(p.body as Phaser.Physics.Arcade.Body).setEnable(true)
    })
  }

  private gameOver() {
    this.registry.set('persistedAbilities', null)
    this.registry.set('persistedHearts', null)
    this.registry.set('persistedBoosts', null)
    this.registry.set('skeletonKingDefeated', null)
    this.registry.set('zombieKingDefeated', null)
    this.registry.set('celeryManDefeated', null)
    this.registry.set('dadSaved', null)
    this.registry.set('momSaved', null)
    this.registry.set('collectedLetters', [])
    this.registry.set('level1Word', null)
    this.registry.set('level2Word', null)
    this.registry.set('level1BugLetters', null)
    this.registry.set('level2BugLetters', null)
    this.registry.set('level1BugPositions', null)
    this.registry.set('level2BugPositions', null)
    this.registry.set('hasLevel1Key', null)
    this.registry.set('hasLevel2Key', null)
    this.registry.set('runRooms', null)
    this.registry.set('runIndex', 0)
    this.registry.set('entryDir', null)
    SoundManager.stopTrack()
    this.cameras.main.fadeOut(800, 80, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene')
    })
  }

  private exitRoom(dir: ExitDir) {
    if (this.roomTransitioning) return
    if (!this.gm.isPlaying()) return

    const runRooms: RoomConfig[] = this.registry.get('runRooms') ?? []
    const runIndex: number = this.registry.get('runIndex') ?? 0
    const goBack = (((dir === 'left' || dir === 'bottom') && !this.cfg.leftExitForward) || (dir === 'right' && !!this.cfg.rightExitBack)) && runIndex > 0

    // Boss room: sealed going forward until boss is defeated; retreat is always allowed
    if (this.cfg.isBossRoom && !this.bossDefeated && !goBack) return

    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.registry.set('score', this.score)
    this.registry.set('persistedHearts',
      this.players.map(p => p.hearts))
    this.registry.set('persistedBoosts',
      this.players.map(p => ({ speedBoostActive: p.speedBoostActive, strengthBoostActive: p.strengthBoostActive, invulnerabilityActive: p.invulnerabilityActive, isTruck: p.isTruck, isTrex: p.isTrex, hasShadow: p.charKey === 'coco' && !!(this.cocoShadow?.active) })))

    const nextIndex = goBack ? runIndex - 1 : runIndex + 1

    // Past the last room = true win → go to victory screen
    if (nextIndex >= runRooms.length) {
      this.cameras.main.fadeOut(800, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('VictoryScene'))
      return
    }

    this.registry.set('runIndex', nextIndex)
    this.registry.set('entryDir', OPPOSITE[dir])

    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private openLevel2Exit(_W: number) {
    this.level2ExitPos = { x: 0, y: 0 }  // flag only; trigger uses p.x >= worldWidth - 100
  }

  private winGame() {
    this.exitRoom('right')
  }

  private showBossCutscene(suffix: string, onComplete: () => void) {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2
    const selectedChars: string[] | undefined = this.registry.get('selectedChars')
    const chars = (selectedChars ?? ['conrad']).slice(0, 4)

    this.physics.world.isPaused = true
    SoundManager.startTrack(this.sound, 'music-boss-victory')

    this.cameras.main.setBackgroundColor('#000000')
    const bg = this.add.rectangle(cx, cy, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(200).setAlpha(0)
    this.tweens.add({ targets: bg, alpha: 1, duration: 250 })

    const elements: Phaser.GameObjects.GameObject[] = [bg]

    // Show each player's character cutscene centered, aspect-ratio preserved
    const count = chars.length
    chars.forEach((charKey, idx) => {
      const imgKey = `cutscene-${charKey}-${suffix}`
      if (!this.textures.exists(imgKey)) return
      const slotW = width / count
      const slotX = slotW * (idx + 0.5)
      const img = this.add.image(slotX, cy, imgKey)
        .setScrollFactor(0).setDepth(201).setAlpha(0)
      const scale = Math.min(slotW / img.width, height / img.height)
      img.setScale(scale)
      elements.push(img)
      this.tweens.add({ targets: img, alpha: 1, duration: 350, delay: 150 })
    })

    // After 3 s, show "press any button" prompt at the top
    this.time.delayedCall(3000, () => {
      if (!this.scene.isActive('GameScene')) return
      const prompt = this.add.text(cx, 40, 'PRESS ANY BUTTON TO CONTINUE', {
        fontSize: '10px', fontFamily: FONT, color: '#ffe066',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202).setAlpha(0)
      elements.push(prompt)
      this.tweens.add({ targets: prompt, alpha: 1, duration: 300 })
      this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, delay: 300 })

      const dismiss = () => {
        this.input.keyboard?.off('keydown', dismiss)
        this.physics.world.isPaused = false
        SoundManager.startTrack(this.sound, 'music-gameplay')
        elements.forEach(e => { if (e.active) e.destroy() })
        onComplete()
      }
      this.input.keyboard?.once('keydown', dismiss)
      this.input.gamepad?.once(Phaser.Input.Gamepad.Events.BUTTON_DOWN, dismiss)
    })
  }

  private showPlaceholderCutscene(message: string, onComplete: () => void, imageKey?: string) {
    const { width, height } = this.scale
    const cx = width / 2

    this.physics.world.isPaused = true
    SoundManager.startTrack(this.sound, 'music-boss-victory')

    this.cameras.main.setBackgroundColor('#000000')
    const bg = this.add.rectangle(cx, height / 2, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(200).setAlpha(0)
    this.tweens.add({ targets: bg, alpha: 1, duration: 250 })

    const elements: Phaser.GameObjects.GameObject[] = [bg]

    if (imageKey && this.textures.exists(imageKey)) {
      const img = this.add.image(cx, height / 2, imageKey)
        .setScrollFactor(0).setDepth(201).setAlpha(0)
      const scale = Math.min(width / img.width, height / img.height)
      img.setScale(scale)
      this.tweens.add({ targets: img, alpha: 1, duration: 300, delay: 100 })
      elements.push(img)
    }

    const title = this.add.text(cx, 44, message, {
      fontSize: '16px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202).setAlpha(0)
    this.tweens.add({ targets: title, alpha: 1, duration: 350, delay: 150 })
    elements.push(title)

    this.time.delayedCall(2000, () => {
      if (!this.scene.isActive('GameScene')) return
      const prompt = this.add.text(cx, height - 50, 'PRESS ANY BUTTON TO CONTINUE', {
        fontSize: '10px', fontFamily: FONT, color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(202).setAlpha(0)
      elements.push(prompt)
      this.tweens.add({ targets: prompt, alpha: 1, duration: 300 })
      this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, delay: 300 })

      const dismiss = () => {
        this.input.keyboard?.off('keydown', dismiss)
        this.physics.world.isPaused = false
        SoundManager.startTrack(this.sound, 'music-gameplay')
        elements.forEach(e => { if (e.active) e.destroy() })
        onComplete()
      }
      this.input.keyboard?.once('keydown', dismiss)
      this.input.gamepad?.once(Phaser.Input.Gamepad.Events.BUTTON_DOWN, dismiss)
    })
  }

  private showBossDefeatedOverlay() {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2

    this.cameras.main.setBackgroundColor('#000000')
    SoundManager.startTrack(this.sound, 'music-final-boss-victory')

    const bg = this.add.rectangle(cx, cy, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(90).setAlpha(0)
    this.tweens.add({ targets: bg, alpha: 1, duration: 250 })

    if (this.textures.exists('cutscene-victory')) {
      const vImg = this.add.image(cx, cy, 'cutscene-victory')
        .setScrollFactor(0).setDepth(91).setAlpha(0)
      const scale = Math.min(width / vImg.width, height / vImg.height)
      vImg.setScale(scale)
      this.tweens.add({ targets: vImg, alpha: 1, duration: 350, delay: 150 })
    }

    const title = this.add.text(cx, cy - 110, 'BOSS DEFEATED!', {
      fontSize: '28px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(92).setAlpha(0)

    const sub = this.add.text(cx, cy - 55, 'What will you do?', {
      fontSize: '11px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(92).setAlpha(0)

    const makeBtn = (x: number, label: string, cb: () => void) => {
      const btn = this.add.text(x, cy + 30, label, {
        fontSize: '10px', fontFamily: FONT, color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
        backgroundColor: '#00000066', padding: { x: 16, y: 12 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(92)
        .setInteractive({ useHandCursor: true }).setAlpha(0)
      btn.on('pointerover', () => btn.setColor('#ffe066'))
      btn.on('pointerout',  () => btn.setColor('#ffffff'))
      btn.on('pointerdown', cb)
      return btn
    }

    const btnContinue = makeBtn(cx - 130, 'CONTINUE\nEXPLORING', () => {
      cleanup()
      ;[bg, title, sub, btnContinue, btnMenu, cursor].forEach(e => e.destroy())
    })

    const btnMenu = makeBtn(cx + 130, 'MAIN MENU', () => {
      cleanup()
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.registry.set('runRooms',           null)
        this.registry.set('runIndex',           0)
        this.registry.set('entryDir',           null)
        this.registry.set('persistedAbilities', null)
        this.registry.set('persistedHearts',    null)
        this.registry.set('score',              0)
        this.registry.set('zombieKingDefeated',  false)
        this.registry.set('celeryManDefeated',   false)
        this.scene.start('MenuScene')
      })
    })

    // Gamepad cursor
    const cursor = this.add.text(0, 0, '►', {
      fontSize: '14px', fontFamily: FONT, color: '#ffe066',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(93).setVisible(false)

    const items = [
      { text: btnContinue, action: () => btnContinue.emit('pointerdown') },
      { text: btnMenu,     action: () => btnMenu.emit('pointerdown') },
    ]
    let focusIdx = 0

    const moveFocus = (dir: number) => {
      focusIdx = (focusIdx + dir + items.length) % items.length
      const b = items[focusIdx].text.getBounds()
      cursor.setPosition(b.left - 10, b.centerY).setVisible(true)
      items.forEach((it, i) => it.text.setColor(i === focusIdx ? '#ffe066' : '#ffffff'))
    }

    const gpHandler = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 14 || button.index === 12) { moveFocus(-1); return }
      if (button.index === 15 || button.index === 13) { moveFocus(1);  return }
      if (button.index === 0  || button.index === 9)  { items[focusIdx]?.action() }
    }

    const cleanup = () => {
      this.input.gamepad?.off(Phaser.Input.Gamepad.Events.BUTTON_DOWN, gpHandler)
    }
    this.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, gpHandler)

    // Fade in text/buttons after image has a moment to appear
    this.tweens.add({ targets: [title, sub, btnContinue, btnMenu], alpha: 1, duration: 400, delay: 300 })

    // Show cursor on first button after content is visible
    this.time.delayedCall(750, () => moveFocus(0))
  }

  private showCongratulatoryOverlay() {
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2

    this.cameras.main.setBackgroundColor('#000000')
    SoundManager.startTrack(this.sound, 'music-end-game')

    const congBg = this.add.rectangle(cx, cy, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(90).setAlpha(0)
    this.tweens.add({ targets: congBg, alpha: 1, duration: 300 })

    this.add.text(cx, cy - 160, 'CONGRATULATIONS!', {
      fontSize: '22px', fontFamily: FONT, color: '#ffd700',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91)

    this.add.text(cx, cy - 110, 'You found the Silly Dragon!', {
      fontSize: '9px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91)

    const enemiesKilled: number = this.registry.get('enemiesKilled') ?? 0
    const hitsTaken: number     = this.registry.get('hitsTaken')     ?? 0
    const startTime: number     = this.registry.get('runStartTime')  ?? Date.now()
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
    const mins = Math.floor(elapsedSec / 60)
    const secs = (elapsedSec % 60).toString().padStart(2, '0')
    const timeStr = `${mins}m ${secs}s`

    const stats = [
      { label: 'Enemies slain',        value: `${enemiesKilled}` },
      { label: 'Times hit',            value: `${hitsTaken}`     },
      { label: 'Time to Silly Dragon', value: timeStr            },
    ]
    stats.forEach(({ label, value }, i) => {
      const y = cy - 55 + i * 32
      this.add.text(cx - 20, y, label, {
        fontSize: '8px', fontFamily: FONT, color: '#aaaaaa',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(91)
      this.add.text(cx + 20, y, value, {
        fontSize: '8px', fontFamily: FONT, color: '#ffe066',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(91)
    })

    const btnMenu = this.add.text(cx, cy + 80, 'MAIN MENU', {
      fontSize: '10px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000066', padding: { x: 16, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91)
      .setInteractive({ useHandCursor: true }).setAlpha(0)

    btnMenu.on('pointerover', () => btnMenu.setColor('#ffe066'))
    btnMenu.on('pointerout',  () => btnMenu.setColor('#ffffff'))
    btnMenu.on('pointerdown', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.registry.set('runRooms',           null)
        this.registry.set('runIndex',           0)
        this.registry.set('entryDir',           null)
        this.registry.set('persistedAbilities', null)
        this.registry.set('persistedHearts',    null)
        this.registry.set('score',              0)
        this.registry.set('enemiesKilled',      0)
        this.registry.set('hitsTaken',          0)
        this.registry.set('runStartTime',       null)
        this.registry.set('zombieKingDefeated', false)
        this.registry.set('celeryManDefeated',  false)
        this.scene.start('MenuScene')
      })
    })

    const gpHandler = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 0 || button.index === 9) btnMenu.emit('pointerdown')
    }
    this.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, gpHandler)

    this.tweens.add({ targets: btnMenu, alpha: 1, duration: 400, delay: 200 })
  }

  // ── input ─────────────────────────────────────────────────────────────────

  private handleKeyboard(p: Player, keys: Record<string, Phaser.Input.Keyboard.Key>) {
    if (!p.isAlive || p.isInhaled) return
    if (keys['left']?.isDown) p.moveLeft()
    else if (keys['right']?.isDown) p.moveRight()
    else p.stopHorizontal()

    if (keys['jump']?.isDown) p.jump()
    else p.jumpReleased()

    p.setShielding(!!keys['inhale']?.isDown)
    if (Phaser.Input.Keyboard.JustDown(keys['ability'])) {
      // Down + ability while in shadow form starts spindash — don't toggle transform
      const downHeld = !!keys['down']?.isDown
      if (p.charKey === 'coco' && p.isShadowForm && downHeld) { /* handled in updateCocoShadow */ }
      else p.useCharacterAbility()
    }
  }

  private handleGamepad(p: Player, pad: Phaser.Input.Gamepad.Gamepad) {
    if (!p.isAlive || p.isInhaled) return
    const lx = pad.leftStick.x
    if (lx < -0.25 || pad.left) p.moveLeft()
    else if (lx > 0.25 || pad.right) p.moveRight()
    else p.stopHorizontal()

    if (pad.A) p.jump()
    else p.jumpReleased()

    p.setShielding(pad.buttons[3]?.pressed ?? false)
  }

  private handleRemoteInput(p: Player, ri: RemoteInput) {
    if (!p.isAlive || p.isInhaled) return
    if (ri.left)        p.moveLeft()
    else if (ri.right)  p.moveRight()
    else                p.stopHorizontal()

    if (ri.jump) p.jump()
    else         p.jumpReleased()

    p.setShielding(ri.inhale)
    if (ri.ability) p.useCharacterAbility()
  }

  private setupGamepadEvents() {
    this.input.gamepad?.on(
      Phaser.Input.Gamepad.Events.BUTTON_DOWN,
      (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        // Start button (9) always toggles pause regardless of player state
        // Start button is blocked while the word menu is open (it is modal)
        if (button.index === 9) { if (!this.wordMenuNav) this.togglePause(); return }

        // D-pad navigates whichever menu is currently open
        if (!this.gm.isPlaying()) {
          if (this.wordMenuNav) {
            if (button.index === 12) { this.wordMenuNav.up();       return }
            if (button.index === 13) { this.wordMenuNav.down();     return }
            if (button.index === 14) { this.wordMenuNav.left?.();   return }
            if (button.index === 15) { this.wordMenuNav.right?.();  return }
            if (button.index === 0)  { this.wordMenuNav.confirm();  return }
            return
          }
          if (button.index === 12) { this.movePauseFocus(-1); return }
          if (button.index === 13) { this.movePauseFocus(1);  return }
          if (button.index === 0)  { this.pauseItems[this.pauseFocusIdx]?.action(); return }
        }

        const player = this.players.find((_, i) => this.input.gamepad?.getPad(i) === pad)
        if (!player || !player.isAlive || player.isInhaled) return
        if (button.index === 1) player.useCharacterAbility()
        if (button.index === 2) player.swingMelee()
        // D-pad up (12) near throne door — same as pressing Up on keyboard
        if (button.index === 12 && this.cfg.isThrone) {
          const nearDoor = Math.abs(player.x - this.throneX) < 70
          if (nearDoor) this.winGame()
        }
        if (button.index === 12 && this.bossPortalPos) {
          const nearPortal = Phaser.Math.Distance.Between(player.x, player.y, this.bossPortalPos.x, this.bossPortalPos.y) < 90
          if (nearPortal) this.winGame()
        }
        if (button.index === 12 && this.backPortalPos) {
          const nearBack = Phaser.Math.Distance.Between(player.x, player.y, this.backPortalPos.x, this.backPortalPos.y) < 90
          if (nearBack) this.useBackPortal()
        }
        if (button.index === 12 && this.hiddenPortalPos) {
          const nearHidden = Phaser.Math.Distance.Between(player.x, player.y, this.hiddenPortalPos.x, this.hiddenPortalPos.y) < 90
          if (nearHidden) this.useHiddenPortal()
        }
      },
    )
  }

  // ── pause menu ────────────────────────────────────────────────────────────

  private buildPauseMenu() {
    const { width, height } = this.scale

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setScrollFactor(0)

    const title = this.add.text(width / 2, height * 0.32, 'PAUSED', {
      fontSize: '32px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0)

    const resume  = this.pauseBtn(width / 2, height * 0.50, '▶  RESUME')
    const toMenu  = this.pauseBtn(width / 2, height * 0.63, '⌂  MAIN MENU')
    const escHint = this.add.text(width / 2, height * 0.77, 'ESC / Start to toggle', {
      fontSize: '9px', fontFamily: FONT, color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0)

    const resumeAction = () => this.togglePause()
    const menuAction   = () => {
      this.gm.resume()
      this.physics.world.isPaused = false
      this.registry.set('runRooms',             null)
      this.registry.set('runIndex',             0)
      this.registry.set('entryDir',             null)
      this.registry.set('skeletonKingDefeated', null)
      this.registry.set('zombieKingDefeated',   null)
      this.registry.set('celeryManDefeated',    null)
      this.registry.set('dadSaved',             null)
      this.registry.set('momSaved',             null)
      this.registry.set('collectedLetters',     [])
      this.registry.set('level1Word',           null)
      this.registry.set('level2Word',           null)
      this.registry.set('level1BugLetters',     null)
      this.registry.set('level2BugLetters',     null)
      this.registry.set('level1BugPositions',   null)
      this.registry.set('level2BugPositions',   null)
      this.registry.set('hasLevel1Key',         null)
      this.registry.set('hasLevel2Key',         null)
      SoundManager.stopTrack()
      this.scene.start('MenuScene')
    }
    resume.on('pointerdown', resumeAction)
    toMenu.on('pointerdown', menuAction)

    this.pauseContainer = this.add.container(0, 0, [overlay, title, resume, toMenu, escHint])
      .setDepth(100).setVisible(false)

    this.pauseItems = [
      { text: resume, action: resumeAction },
      { text: toMenu, action: menuAction   },
    ]

    // Cursor lives outside the container so it can move freely
    this.pauseCursor = this.add.text(0, 0, '►', {
      fontSize: '16px', fontFamily: FONT, color: '#ffe066',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(200).setVisible(false)
  }

  private pauseBtn(x: number, y: number, label: string): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontSize: '16px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000055', padding: { x: 22, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => btn.setColor('#ffe066'))
    btn.on('pointerout',  () => btn.setColor('#ffffff'))
    return btn
  }

  private togglePause() {
    if (this.wordMenuNav) return  // word menu is modal — ESC/Start cannot interrupt it
    const nowPaused = this.gm.isPlaying()
    if (nowPaused) this.gm.pause()
    else this.gm.resume()
    this.pauseContainer.setVisible(nowPaused)
    this.physics.world.isPaused = nowPaused
    // Reset cursor when closing pause
    if (!nowPaused && this.pauseCursor) this.pauseCursor.setVisible(false)
  }

  private movePauseFocus(dir: number) {
    const len = this.pauseItems.length
    if (!len || !this.pauseCursor) return
    this.pauseFocusIdx = (this.pauseFocusIdx + dir + len) % len
    const b = this.pauseItems[this.pauseFocusIdx].text.getBounds()
    this.pauseCursor.setPosition(b.left - 12, b.centerY).setVisible(true)
  }

  // ── update ────────────────────────────────────────────────────────────────

  update(_t: number, _dt: number) {
    if (!this.gm.isPlaying()) return

    const sx = this.cameras.main.scrollX
    if (this.bgLayers[0]) this.bgLayers[0].tilePositionX = sx * 0.05
    if (this.bgLayers[1]) this.bgLayers[1].tilePositionX = sx * 0.18

    if (this.players.length > 0) {
      const alive = this.players.filter(p => p.isAlive)
      if (alive.length > 0) {
        const ax = alive.reduce((s, p) => s + p.x, 0) / alive.length
        const ay = alive.reduce((s, p) => s + p.y, 0) / alive.length
        this.cameraTarget.setPosition(ax, ay)
      }
    }

    this.players.forEach((p, i) => {
      p.update()

      const shieldGfx = this.shieldGraphics[i]
      if (shieldGfx) {
        shieldGfx.clear()
        if (p.isTruck) {
          const moving = Math.abs((p.body as Phaser.Physics.Arcade.Body).velocity.x) > 10
          const animKey = moving ? 'eric-anim-truck-move' : 'eric-anim-truck-idle'
          if (p.anims.currentAnim?.key !== animKey) p.play(animKey, true)
        }
        if (p.isTrex) {
          const moving = Math.abs((p.body as Phaser.Physics.Arcade.Body).velocity.x) > 10
          const animKey = moving ? 'trex-walk' : 'trex-idle'
          if (p.anims.currentAnim?.key !== animKey) p.play(animKey, true)
        }

      if (p.isAlive && p.shielding && !p.isInhaled) {
          const t   = this.time.now
          const R   = 58   // shield radius

          // Soft inner fill — pulses gently
          const fill = 0.22 + 0.10 * Math.sin(t / 130)
          shieldGfx.fillStyle(0x55bbff, fill)
          shieldGfx.fillCircle(p.x, p.y, R)

          // Bright outer ring
          shieldGfx.lineStyle(3, 0xaaeeff, 0.85 + 0.15 * Math.sin(t / 90))
          shieldGfx.strokeCircle(p.x, p.y, R)

          // Second inner ring
          shieldGfx.lineStyle(1, 0xffffff, 0.30 + 0.20 * Math.sin(t / 70 + 1))
          shieldGfx.strokeCircle(p.x, p.y, R - 8)

          // Orbiting star-points (6 points spaced evenly, each a small 4-pointed star)
          const STAR_COUNT = 6
          for (let s = 0; s < STAR_COUNT; s++) {
            const angle  = (t / 600) + (s / STAR_COUNT) * Math.PI * 2
            const twinkle = 0.5 + 0.5 * Math.sin(t / 180 + s * 1.3)
            const sx = p.x + Math.cos(angle) * R
            const sy = p.y + Math.sin(angle) * R
            const sr = 3 + 2 * twinkle   // star radius pulses

            shieldGfx.fillStyle(0xffffff, 0.7 + 0.3 * twinkle)
            // Four-pointed cross star
            shieldGfx.fillRect(sx - sr / 2, sy - 1, sr, 2)
            shieldGfx.fillRect(sx - 1, sy - sr / 2, 2, sr)
          }

          // Small inner sparkles at fixed angles, randomly twinkling
          const SPARK_COUNT = 8
          for (let s = 0; s < SPARK_COUNT; s++) {
            const angle  = (t / 900 + s * 0.5) + s * (Math.PI * 2 / SPARK_COUNT)
            const dist   = (R - 16) + 6 * Math.sin(t / 200 + s * 0.7)
            const alpha  = 0.2 + 0.6 * Math.abs(Math.sin(t / 250 + s * 1.1))
            shieldGfx.fillStyle(0xddeeff, alpha)
            shieldGfx.fillRect(
              p.x + Math.cos(angle) * dist - 1,
              p.y + Math.sin(angle) * dist - 1,
              2, 2,
            )
          }
        }
      }

      const remoteIds: number[] = this.registry.get('remotePlayers') ?? []
      const isRemote = remoteIds.includes(p.playerId)

      if (isRemote) {
        const ri = this.remoteInputs.get(p.playerId)
        if (ri) this.handleRemoteInput(p, ri)
      } else {
        const pad = this.input.gamepad?.getPad(this.nm ? 0 : p.playerId)
        if (pad?.connected) {
          this.handleGamepad(p, pad)
        } else {
          const keys = this.playerKeysets.get(p.playerId)
          if (keys) this.handleKeyboard(p, keys)
          if (this.touchControls) this.touchControls.apply(p)
        }

        if (this.nm) {
          const pad2 = this.input.gamepad?.getPad(0)
          const keys = this.playerKeysets.get(p.playerId)
          this.nm.sendInput({
            left:    !!(pad2?.connected ? (pad2.leftStick.x < -0.25 || pad2.left) : keys?.['left']?.isDown),
            right:   !!(pad2?.connected ? (pad2.leftStick.x >  0.25 || pad2.right) : keys?.['right']?.isDown),
            jump:    !!(pad2?.connected ? pad2.A : keys?.['jump']?.isDown),
            inhale:  !!(pad2?.connected ? (pad2.buttons[3]?.pressed) : keys?.['inhale']?.isDown),
            ability: !!(pad2?.connected ? pad2.buttons[1]?.pressed : keys?.['ability']?.isDown),
          })
        }
      }

      if (p.shielding) {
        // Absorb enemy projectiles while shielding
        ;(this.enemyProjectiles.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(proj => {
          if (!proj.active) return
          if (Phaser.Math.Distance.Between(p.x, p.y, proj.x, proj.y) < 50) proj.destroy()
        })
      }

      // Exit boundary detection (all modes except continuous worldMap)
      const remoteIds2: number[] = this.registry.get('remotePlayers') ?? []
      const isLocalPlayer = !remoteIds2.includes(p.playerId)
      const isContinuousWorld = !!this.cfg.worldMap && !this.cfg.worldMap.section && !this.cfg.isBossRoom && this.cfg.exits.length === 0
      if (isLocalPlayer && !this.roomTransitioning && p.isAlive && !isContinuousWorld) {
        const W = this.cfg.worldWidth
        const exits = this.cfg.exits
        const ep2 = this.cfg.exitPositions ?? {}
        if (p.x < 0   && exits.includes('left')   && Math.abs(p.y - (ep2.left   ?? 640))   < DOOR_H / 2) { this.exitRoom('left');   return }
        const rightTrigX = this.cfg.rightExitX ?? W
        if (p.x > rightTrigX && exits.includes('right') &&
            (this.cfg.rightExitX !== undefined || Math.abs(p.y - (ep2.right ?? 640)) < DOOR_H / 2)) {
          this.exitRoom('right'); return
        }
        if (p.y < 0   && exits.includes('top')    && Math.abs(p.x - (ep2.top    ?? W / 2)) < DOOR_W / 2) { this.exitRoom('top');    return }
        if (p.y > 740 && exits.includes('bottom') && Math.abs(p.x - (ep2.bottom ?? W / 2)) < DOOR_W / 2) { this.exitRoom('bottom'); return }
      }

      // One-shot touch interact flag for portal/door entry (consumed here, valid for this player only)
      const touchInteract = isLocalPlayer ? (this.touchControls?.interactJust ?? false) : false

      // Throne room: press Up near the door (keyboard, gamepad, or touch)
      if (this.cfg.isThrone && isLocalPlayer && p.isAlive) {
        const jumpKey = this.playerKeysets.get(p.playerId)?.['jump']
        const nearDoor = Math.abs(p.x - this.throneX) < 70
        this.throneLabel?.setVisible(nearDoor)
        if (nearDoor && (touchInteract || (jumpKey && Phaser.Input.Keyboard.JustDown(jumpKey)))) this.winGame()
      }

      if (this.bossPortalPos && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        const nearPortal = Phaser.Math.Distance.Between(p.x, p.y, this.bossPortalPos.x, this.bossPortalPos.y) < 90
        this.portalLabel?.setVisible(nearPortal)
        const jumpKey = this.playerKeysets.get(p.playerId)?.['jump']
        if (nearPortal && (touchInteract || (jumpKey && Phaser.Input.Keyboard.JustDown(jumpKey)))) this.winGame()
      }

      // Back portal — non-glowing boss door for returning to previous room (CONTINUE mode)
      if (this.backPortalPos && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        const nearBack = Phaser.Math.Distance.Between(p.x, p.y, this.backPortalPos.x, this.backPortalPos.y) < 90
        this.backPortalLbl?.setVisible(nearBack)
        const jumpKey2 = this.playerKeysets.get(p.playerId)?.['jump']
        if (nearBack && (touchInteract || (jumpKey2 && Phaser.Input.Keyboard.JustDown(jumpKey2)))) {
          this.useBackPortal()
        }
      }

      // Hidden portal — secret door to bonus room, appears after boss defeated
      if (this.hiddenPortalPos && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        const nearHidden = Phaser.Math.Distance.Between(p.x, p.y, this.hiddenPortalPos.x, this.hiddenPortalPos.y) < 90
const jumpKey3 = this.playerKeysets.get(p.playerId)?.['jump']
        if (nearHidden && (touchInteract || (jumpKey3 && Phaser.Input.Keyboard.JustDown(jumpKey3)))) {
          this.useHiddenPortal()
        }
      }

      // Barrier exit — auto-transition when player walks into a wall that seals an exit.
      // Uses one-sided x check: trigger fires once the player reaches or passes be.x
      // (the wall stops them there), gated by a vertical band around be.y.
      if (this.cfg.barrierExit && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        const be = this.cfg.barrierExit
        if (p.x >= be.x && Math.abs(p.y - be.y) < 300) {
          this.useBackPortal()
        }
      }

      // Level 2 exit — walk into the right world boundary after defeating the dragon
      if (this.level2ExitPos && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        if (p.x >= this.cfg.worldWidth - 100) {
          this.exitRoom('right')
          return
        }
      }

      // Back exit — walk into the left world boundary
      if (this.backExitPos && isLocalPlayer && p.isAlive && !this.roomTransitioning) {
        if (p.x <= 100) {
          this.exitRoom('left')
          return
        }
      }
    })

    // Collectibles
    this.collectibleSprites = this.collectibleSprites.filter(img => {
      if (!img.active) return false
      for (const p of this.players) {
        if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, img.x, img.y) < 32) {
          this.collectItem(p, img.getData('item') as ItemSpawn)
          ;(img.getData('ring') as Phaser.GameObjects.Arc | undefined)?.destroy()
          ;(img.getData('keyBubble') as Phaser.GameObjects.Container | undefined)?.destroy()
          img.destroy()
          return false
        }
      }
      return true
    })

    // Enemies
    this.enemies = this.enemies.filter(e => e.active)
    this.enemies.forEach(e => {
      e.update()
      if (e.tryAttack(_dt)) this.spawnEnemyProjectile(e)
    })

    // Boss
    if (this.boss?.active) {
      this.boss.players = this.players
      this.boss.update()
    }

    this.updateConradTrucks()
    this.updateCocoShadow()
    this.updateCallumNumbers()
    this.checkCeleryBoost()
    this.updateParentHints()
    this.ui.update(this.players)

    // Debug: log first player position every 2 seconds
    this._debugLogTimer += _dt
    if (this._debugLogTimer >= 2000) {
      this._debugLogTimer = 0
      const p0 = this.players[0]
      if (p0?.isAlive) console.log(`[pos] x=${Math.round(p0.x)} y=${Math.round(p0.y)}`)
    }

    // Hide/show touch controls when a gamepad is connected or disconnected
    if (this.touchControls) {
      const padConnected = this.input.gamepad?.gamepads.some(p => p?.connected) ?? false
      if (padConnected !== this._lastPadConnected) {
        this._lastPadConnected = padConnected
        this.touchControls.setEnabled(!padConnected)
      }
    }
  }
}
