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
import { RoomConfig, ExitDir, generateRun, TOTAL_WORMS, TOTAL_ROLY_POLYS } from '../levels'
import { AbilityType, DamageType } from '../types'
import { ItemSpawn } from '../levels'
import { NetworkManager, RemoteInput } from '../network/NetworkManager'
import { SoundManager } from '../audio/SoundManager'

const FONT = '"Press Start 2P", monospace'
const SCORE_ENEMY = 200
const SCORE_DESTRUCT = 100

const KEYBOARD_CONFIGS: Record<string, string>[] = [
  { left: 'A',    right: 'D',     jump: 'W',  inhale: 'C',     ability: 'X' },
  { left: 'LEFT', right: 'RIGHT', jump: 'UP', inhale: 'COMMA', ability: 'L' },
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
  private backPortalPos:  { x: number; y: number } | null = null
  private backPortalLbl:  Phaser.GameObjects.Text | null = null
  private pauseItems: { text: Phaser.GameObjects.Text; action: () => void }[] = []
  private pauseFocusIdx = 0
  private pauseCursor: Phaser.GameObjects.Text | null = null

  private collectibleSprites: Phaser.GameObjects.Image[] = []
  private shieldGraphics: Phaser.GameObjects.Graphics[] = []
  private tilemapLayers: Phaser.Tilemaps.TilemapLayer[] = []
  private carterDuplicates: CarterDuplicate[] = []
  private conradTrucks: ConradArmyTruck[] = []
  private cocoShadow: CocoShadow | null = null
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
    this.crates = []; this.bgLayers = []; this.collectibleSprites = []; this.shieldGraphics = []; this.carterDuplicates = []; this.conradTrucks = []; this.cocoShadow = null; this.callumNumbers = []
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
    this.backPortalPos = null
    this.backPortalLbl = null
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
      this.boss.on('bossAttack', (ability: AbilityType) => this.fireBossSpecial(ability))
      this.ui.updateBossBar(this.cfg.bossHp!, this.cfg.bossHp!)
    }

    this.wirePlayerUIEvents()
    this.ui.updateWormCount(this.registry.get('wormCount') ?? 0)
    this.ui.updateRolyPolyCount(this.registry.get('rolyPolyCount') ?? 0)
    this.buildNPCs()
    this.buildTorches()
    this.buildPauseMenu()
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause())
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const defeatedKey = this.cfg.bossDefeatedKey
    const isBossRoomLive = this.cfg.isBossRoom && !(defeatedKey && this.registry.get(defeatedKey))
    SoundManager.startTrack(this.sound, isBossRoomLive ? 'music-boss' : 'music-gameplay')
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
    for (const item of this.cfg.items) {
      if (isInsideWall(item.x, item.y)) continue
      const isSuperAbility = item.type === 'speed' || item.type === 'attack-boost' || item.type === 'invulnerability'
      if (isSuperAbility && !isLocalhost) continue
      const tex = item.type === 'heart'            ? 'item-heart'
                : item.type === 'pizza'            ? 'item-pizza'
                : item.type === 'worm'             ? 'item-worm'
                : item.type === 'roly-poly'        ? 'item-roly-poly'
                : item.type === 'life'             ? 'item-life'
                : item.type === 'mystery'          ? 'item-mystery'
                : item.type === 'invulnerability'  ? 'invulnerability_icon'
                : 'item-orb'
      const isHidden = item.type === 'speed' || item.type === 'attack-boost' || item.type === 'invulnerability'
      const img = this.add.image(item.x, item.y, tex).setDepth(8)
        .setScale(item.type === 'mystery' ? 2.2
          : item.type === 'worm' || item.type === 'roly-poly' ? 1.0 : 1.2)
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
    } else if (item.type === 'worm') {
      const wc = (this.registry.get('wormCount') ?? 0) + 1
      this.registry.set('wormCount', wc)
      this.ui.updateWormCount(wc)
      this.showPopup(item.x, item.y, 'WORM!', '#aaffaa')
      SoundManager.collectHeart()
    } else if (item.type === 'roly-poly') {
      const rc = (this.registry.get('rolyPolyCount') ?? 0) + 1
      this.registry.set('rolyPolyCount', rc)
      this.ui.updateRolyPolyCount(rc)
      this.showPopup(item.x, item.y, 'ROLY POLY!', '#ffddaa')
      SoundManager.collectHeart()
    } else if (item.type === 'invulnerability') {
      player.applyInvulnerability(true)
      this.showPopup(item.x, item.y, 'INVINCIBLE!', '#4499ff')
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
      'Collect ALL worms &',
      'roly polies to save',
      'Mom & Dad before the',
      'final boss!',
    ], null)
  }

  private buildSkeletonKingNPCs() {
    if (this.registry.get('dadSaved')) return

    this.dadNpcSprite  = this.add.image(633, 791, 'npc-dad', 14).setDepth(2).setScale(1.5)
    this.dadCageGfx    = this.drawCage(633, 791, 80, 100)
    this.dadCageBubble = this.showNpcBubble(633, 710, ['Help me!'], null)
    this.checkDadFreed()
  }

  private buildZombieKingNPCs() {
    if (this.registry.get('momSaved')) return

    this.momNpcSprite  = this.add.image(542, 1079, 'npc-mom', 12).setDepth(2).setScale(1.5)
    this.momCageGfx    = this.drawCage(542, 1079, 80, 100)
    this.momCageBubble = this.showNpcBubble(542, 998, ['Help me!'], null)
    this.checkMomFreed()
  }

  private buildCeleryManNPCs() {
    const dadSaved = !!(this.registry.get('dadSaved'))
    const momSaved = !!(this.registry.get('momSaved'))
    const npcX = 700, npcY = 1900

    if (dadSaved && momSaved) {
      const dadImg = this.add.image(npcX - 35, npcY, 'npc-dad', 8).setDepth(2).setScale(1.5)
      const momImg = this.add.image(npcX + 35, npcY, 'npc-mom', 15).setDepth(2).setScale(1.5)

      this.showNpcBubble(npcX, npcY - 100, [
        `You saved us, ${this.npcCharNames()}!`,
        'Take our power and',
        'defeat Celery Man!',
      ], 6000)

      // Grant boosts after a short delay so players are settled
      this.time.delayedCall(800, () => {
        this.players.forEach(p => {
          if (!p.invulnerabilityActive) p.applyInvulnerability(true)
          if (!p.speedBoostActive)      p.applySpeedBoost(true)
          if (!p.strengthBoostActive)   p.applyStrengthBoost(true)
        })
      })

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

  private checkDadFreed(): boolean {
    if (this.registry.get('dadSaved')) return true
    const bossBeaten = !!(this.registry.get('skeletonKingDefeated'))
    const wormsOk    = (this.registry.get('wormCount') ?? 0) >= TOTAL_WORMS
    if (bossBeaten && wormsOk) { this.freeDad(); return true }
    return false
  }

  private checkMomFreed(): boolean {
    if (this.registry.get('momSaved')) return true
    const bossBeaten = !!(this.registry.get('zombieKingDefeated'))
    const rolysOk    = (this.registry.get('rolyPolyCount') ?? 0) >= TOTAL_ROLY_POLYS
    if (bossBeaten && rolysOk) { this.freeMom(); return true }
    return false
  }

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

    const dadSaved = !!(this.registry.get('dadSaved'))
    const momBubble = this.showNpcBubble(this.momNpcSprite.x, this.momNpcSprite.y - 100, [
      `Thank you, ${this.npcCharNames()}!`,
      dadSaved ? "I'll have something" : 'Now hurry and',
      dadSaved ? 'special waiting!'    : 'save Dad!',
    ], null)

    this.time.delayedCall(30000, () => {
      if (!this.momNpcSprite?.active) return
      this.tweens.add({
        targets: [this.momNpcSprite, momBubble], alpha: 0, duration: 1500,
        onComplete: () => { this.momNpcSprite?.destroy(); this.momNpcSprite = null; momBubble.destroy() },
      })
    })
  }

  private updateParentHints() {
    const PROX = 140

    const updateHint = (
      sprite:    Phaser.GameObjects.Image | null,
      bossKey:   string,
      countKey:  string,
      total:     number,
      lines:     string[],
      bubble:    Phaser.GameObjects.Container | null,
      setBubble: (b: Phaser.GameObjects.Container | null) => void,
    ) => {
      if (!sprite?.active) return
      if (!this.registry.get(bossKey)) return          // boss not beaten yet
      if ((this.registry.get(countKey) ?? 0) >= total) return  // already collected all

      const near = this.players.some(p =>
        p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, sprite.x, sprite.y) < PROX
      )

      if (near && !bubble?.active) {
        // "Help me!" bubble sits ~81px above the sprite; place hint ~70px above that
        const hint = this.showNpcBubble(sprite.x, sprite.y - 160, lines, null)
        setBubble(hint)
      } else if (!near && bubble?.active) {
        bubble.destroy()
        setBubble(null)
      }
    }

    updateHint(
      this.dadNpcSprite, 'skeletonKingDefeated', 'wormCount', TOTAL_WORMS,
      ['Collect all worms', 'to free me!'],
      this.dadHintBubble, b => { this.dadHintBubble = b },
    )

    updateHint(
      this.momNpcSprite, 'zombieKingDefeated', 'rolyPolyCount', TOTAL_ROLY_POLYS,
      ['Collect all roly polies', 'to free me!'],
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
        this.spawnFurniturePiece(fs.type, fs.x, furnY, fs.ability ?? AbilityType.None, hp)
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
          const barrier = this.add.rectangle(150, barrierH / 2, 20, barrierH, 0x000000, 0)
          this.physics.add.existing(barrier, true)
          this.platforms.add(barrier as unknown as Phaser.Physics.Arcade.Image)
          this.bossRoomLeftBarrier = barrier

          const rBarrier = this.add.rectangle(this.cfg.bossRightBarrierX ?? W - 150, this.cfg.bossRightBarrierY ?? barrierH / 2, 20, barrierH, 0x000000, 0)
          this.physics.add.existing(rBarrier, true)
          this.platforms.add(rBarrier as unknown as Phaser.Physics.Arcade.Image)
          this.bossRoomRightBarrier = rBarrier

          this.boss = new Boss(this, this.cfg.bossSpawnX, bossY, this.cfg.bossHp, 3000, this.cfg.bossKey, this.cfg.bossFlying !== false, this.cfg.bossStationary ?? false, this.cfg.bossAttackRate ?? 3000)
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
            if (dk === 'skeletonKingDefeated') this.checkDadFreed()
            else if (dk === 'zombieKingDefeated') this.checkMomFreed()

            const hasCutscene = dk === 'skeletonKingDefeated' || dk === 'zombieKingDefeated'
            const cutsceneSuffix = dk === 'skeletonKingDefeated' ? 'skeleton_king' : 'zombie_king'

            if (hasCutscene) {
              // Show cutscene immediately — it handles its own music
              this.showBossCutscene(cutsceneSuffix, () => {
                if (this.cfg.backPortal) this.buildBackPortal()
                if (runIndex + 1 < runRooms.length) this.openLevel2Exit(W)
                else this.showBossDefeatedOverlay()
              })
            } else if (runIndex + 1 < runRooms.length) {
              // More levels — reveal right exit and back portal after brief celebration
              SoundManager.startTrack(this.sound, 'music-gameplay')
              if (this.cfg.backPortal) this.time.delayedCall(800, () => this.buildBackPortal())
              this.time.delayedCall(1800, () => { this.openLevel2Exit(W) })
            } else {
              // Final boss — fanfare + overlay
              if (this.cfg.backPortal) this.time.delayedCall(800, () => this.buildBackPortal())
              this.time.delayedCall(1800, () => this.showBossDefeatedOverlay())
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

      // Coming-soon glow at right exit — white-yellow gradient, no hard wall visual
      if (this.cfg.comingSoonGlowRight) {
        const W2  = this.cfg.worldWidth
        const ey  = this.cfg.exitPositions?.right ?? 1952
        const gy  = ey - 25   // glow center shifted up 25px
        const color = 0xffee88
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
        // Text: original position adjusted — left 10px, down 20px
        this.add.text(W2 - 58, ey - 70, 'COMING SOON!', {
          fontSize: '9px', fontFamily: FONT, color: '#ffee88',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0.5).setDepth(10)
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
      this.boss = new Boss(this, this.cfg.bossSpawnX, this.cfg.bossSpawnY ?? 620, this.cfg.bossHp, 3000, this.cfg.bossKey, this.cfg.bossFlying !== false)
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
    resistances: Partial<Record<DamageType, number>> = {}
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
      const cl = ability === AbilityType.Fire     ? 0xff6600
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
      if (Math.random() < 0.25) this.spawnFurnitureDrop(obj.x, obj.y)
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
      p.on('heartLost', () => {})
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
    this.registry.set('persistedBoosts',    this.players.map(pl => ({ speedBoostActive: pl.speedBoostActive, strengthBoostActive: pl.strengthBoostActive, invulnerabilityActive: pl.invulnerabilityActive, isTruck: pl.isTruck, isTrex: pl.isTrex, hasShadow: pl.charKey === 'coco' && !!(this.cocoShadow?.active) })))
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
          this.spawnCocoShadow(p)
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
        if (player.isTruck || player.isTrex) {
          enemy.die()
          this.addScore(SCORE_ENEMY)
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
          const player = _p as Player
          const boss   = _b as unknown as Boss
          if (Math.abs(player.y - boss.y) > 350) return
          if (player.isTruck || player.isTrex) this.hitBoss(player)
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

  private hitEnemy(e: Enemy, src: Player) {
    if (src.strengthBoostActive) e.die()
    else e.hit()
    this.addScore(SCORE_ENEMY)
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
        truck.isShooting = true
        truck.setData('shootHold', now + 800)
        truck.setFlipX(nearTarget.x < truck.x)
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
    if (!target) return

    const angle = Phaser.Math.Angle.Between(truck.x, truck.y - 10, target.x, target.y)
    const texKey = this.textures.exists('proj-fire') ? 'proj-fire' : 'fireball'
    const proj = this.physics.add.image(truck.x, truck.y - 10, texKey)
    proj.setTint(0x44cc44)
    this.projectiles.add(proj)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * 520, Math.sin(angle) * 520)
      .setGravityY(-800)

    this.enemies.forEach(e => {
      this.physics.add.overlap(proj, e, () => { this.hitEnemy(e, this.players[0]); proj.destroy() })
    })
    if (this.boss?.active) {
      this.physics.add.overlap(proj, this.boss, () => {
        if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
            (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
        SoundManager.bossHit()
        this.boss!.hit()
        proj.destroy()
      })
    }
    this.time.delayedCall(2200, () => { if (proj.active) proj.destroy() })
  }

  // ── Coco shadow ability ───────────────────────────────────────────────────────

  private handleCocoShadow(coco: Player) {
    if (this.cocoShadow?.active) {
      this.cocoShadow.release()
    } else {
      this.spawnCocoShadow(coco)
    }
  }

  private spawnCocoShadow(coco: Player) {
    if (!this.textures.exists('sheet-shadow')) return
    const shadow = new CocoShadow(this, coco.x, coco.y)
    this.cocoShadow = shadow

    this.physics.add.collider(shadow, this.platforms)
    this.tilemapLayers.forEach(l => this.physics.add.collider(shadow, l))

    // When shadow is ready to charge, set its velocity toward the target
    shadow.on('startCharge', (_s: CocoShadow, target: Phaser.GameObjects.Sprite) => {
      if (!shadow.active) return
      const body = shadow.body as Phaser.Physics.Arcade.Body
      const flying = (target as Enemy).flying ?? false
      if (flying) {
        const angle = Phaser.Math.Angle.Between(shadow.x, shadow.y, target.x, target.y)
        body.setAllowGravity(false)
        body.setVelocity(
          Math.cos(angle) * CocoShadow.chargeSpeed,
          Math.sin(angle) * CocoShadow.chargeSpeed,
        )
      } else {
        const dir = target.x >= shadow.x ? 1 : -1
        body.setAllowGravity(false)
        body.setVelocity(dir * CocoShadow.chargeSpeed, 0)
        shadow.setFlipX(dir < 0)
      }
    })

    // Enemy collider while charging — 3× damage = instant kill, then spin-down
    this.enemies.forEach(e => {
      this.physics.add.overlap(shadow, e, () => {
        if (shadow.shadowState !== 'charging') return
        e.die()
        this.addScore(SCORE_ENEMY)
        shadow.hitEnemy()
        ;(shadow.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)
      })
    })
    if (this.boss?.active) {
      this.physics.add.overlap(shadow, this.boss, () => {
        if (shadow.shadowState !== 'charging') return
        if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
            (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
        SoundManager.bossHit()
        this.boss!.hit()
        shadow.hitEnemy()
        ;(shadow.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)
      })
    }

    // Absorb enemy projectiles while spindashing
    this.physics.add.overlap(shadow, this.enemyProjectiles, (_s, proj) => {
      if (shadow.shadowState === 'charging') (proj as Phaser.Physics.Arcade.Image).destroy()
    })

    shadow.on('shadowReleased', () => { this.cocoShadow = null })
  }

  private shadowHasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    if (this.tilemapLayers.length === 0) return true
    const STEPS = 14
    for (let i = 1; i < STEPS; i++) {
      const t = i / STEPS
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      for (const layer of this.tilemapLayers) {
        const tile = layer.getTileAtWorldXY(x, y)
        if (tile && tile.index >= 0) return false
      }
    }
    return true
  }

  private updateCocoShadow() {
    const shadow = this.cocoShadow
    if (!shadow?.active) return

    // Find Coco (the player who owns the shadow)
    const coco = this.players.find(p => p.charKey === 'coco' && p.isAlive)

    if (shadow.shadowState === 'idle') {
      // Re-enable gravity in case a flying charge just finished
      ;(shadow.body as Phaser.Physics.Arcade.Body).setAllowGravity(true)

      // Follow Coco
      if (coco) {
        const cocoBody   = coco.body as Phaser.Physics.Arcade.Body
        const shadowBody = shadow.body as Phaser.Physics.Arcade.Body

        // Jump when Coco jumps (Coco going up and Shadow still grounded)
        if (cocoBody.velocity.y < -300 && shadowBody.blocked.down) {
          shadowBody.setVelocityY(cocoBody.velocity.y)
        }

        const targetX = coco.x + (coco.flipX ? 60 : -60)
        const dx = targetX - shadow.x
        if (Math.abs(dx) > 12) {
          const dir = dx > 0 ? 1 : -1
          shadowBody.setVelocityX(dir * 350)
          shadow.setFlipX(dir < 0)
        } else {
          shadowBody.setVelocityX(0)
        }
      }

      // Scan for nearest enemy to trigger spin-dash
      let nearTarget: Phaser.GameObjects.Sprite | null = null
      let nearDist = CocoShadow.detectRange

      for (const e of this.enemies) {
        if (!e.active) continue
        const d = Phaser.Math.Distance.Between(shadow.x, shadow.y, e.x, e.y)
        if (d < nearDist && this.shadowHasLineOfSight(shadow.x, shadow.y, e.x, e.y)) {
          nearDist = d; nearTarget = e
        }
      }
      if (this.boss?.active) {
        const d = Phaser.Math.Distance.Between(shadow.x, shadow.y, this.boss.x, this.boss.y)
        if (d < nearDist && this.shadowHasLineOfSight(shadow.x, shadow.y, this.boss.x, this.boss.y)) {
          nearDist = d; nearTarget = this.boss
        }
      }

      if (nearTarget) {
        // Begin moving toward the target in a straight line as the spin-up winds up
        const dir = nearTarget.x >= shadow.x ? 1 : -1
        ;(shadow.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * 350)
        shadow.setFlipX(dir < 0)
        shadow.beginSpinUp(nearTarget)
      } else {
        // Walk or idle animation — only while truly idle (no spin-up in progress)
        const shadowBody = shadow.body as Phaser.Physics.Arcade.Body
        const moving  = Math.abs(shadowBody.velocity.x) > 10
        const animKey = moving ? 'shadow-charge' : 'shadow-idle'
        if (shadow.anims.currentAnim?.key !== animKey) shadow.play(animKey, true)
      }
    }
  }

  // ── Callum number ability ─────────────────────────────────────────────────────

  private spawnCallumNumber(src: Player) {
    src.swingMelee()

    const value = Phaser.Math.Between(1, 10)
    const palette = ['#ff6666','#ffdd44','#44ff88','#44ccff','#ff88ff',
                     '#ff9944','#aaffff','#ffffff','#ffaacc','#aaffaa']
    const color = palette[value - 1]

    // Gradient glow shadow behind the number
    const glow = this.add.text(src.x, src.y - 20, `${value}`, {
      fontSize: '80px', fontFamily: FONT, color: '#ffffff',
      stroke: '#ffffff', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(11).setAlpha(0.45)
    glow.setTint(0xaa00ff, 0x0088ff, 0xff0077, 0xffaa00)
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    const num = this.add.text(src.x, src.y - 20, `${value}`, {
      fontSize: '72px', fontFamily: FONT, color,
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(12)

    this.physics.add.existing(num)
    const body = num.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setBounce(1, 1)
    body.setCollideWorldBounds(true)
    this.physics.add.collider(num, this.platforms)
    this.tilemapLayers.forEach(l => this.physics.add.collider(num, l))

    const emitter = this.add.particles(num.x, num.y, '__DEFAULT', {
      lifespan: { min: 400, max: 800 },
      speed: { min: 20, max: 70 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffd700, 0xffffff, 0xccaaff, 0x88ddff, 0xff99aa],
      quantity: 1,
      frequency: 80,
      blendMode: 'ADD',
    }).setDepth(13)

    // Find nearest target
    let target: Phaser.GameObjects.Sprite | null = null
    let best = Infinity
    for (const e of this.enemies) {
      if (!e.active) continue
      const d = Phaser.Math.Distance.Between(src.x, src.y, e.x, e.y)
      if (d < best) { best = d; target = e }
    }
    if (this.boss?.active) {
      const d = Phaser.Math.Distance.Between(src.x, src.y, this.boss.x, this.boss.y)
      if (d < best) { best = d; target = this.boss }
    }

    if (target) {
      const angle = Phaser.Math.Angle.Between(num.x, num.y, target.x, target.y)
      body.setVelocity(Math.cos(angle) * 420, Math.sin(angle) * 420)

      let didHit = false
      const onHit = () => {
        if (!num.active || didHit) return
        didHit = true
        if (target === this.boss) {
          if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
              (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
          SoundManager.bossHit()
          this.boss!.hit()
        } else {
          SoundManager.enemyHit()
          ;(target as Enemy).hit()
          this.addScore(SCORE_ENEMY)
        }
        emitter.destroy()
        if (glow.active) glow.destroy()
        this.tweens.add({
          targets: num, alpha: 0, scaleX: 1.6, scaleY: 1.6,
          duration: 180, onComplete: () => { if (num.active) num.destroy() },
        })
      }

      for (const e of this.enemies) {
        if (e === target) { this.physics.add.overlap(num, e, onHit); break }
      }
      if (target === this.boss && this.boss?.active) {
        this.physics.add.overlap(num, this.boss, onHit)
      }
    }

    this.time.delayedCall(7000, () => {
      if (!num.active) return
      emitter.destroy()
      if (glow.active) glow.destroy()
      this.tweens.add({ targets: num, alpha: 0, duration: 300, onComplete: () => { if (num.active) num.destroy() } })
    })

    this.callumNumbers.push({ obj: num, glow, emitter })
  }

  private updateCallumNumbers() {
    this.callumNumbers = this.callumNumbers.filter(n => n.obj.active)
    for (const n of this.callumNumbers) {
      n.emitter.setPosition(n.obj.x, n.obj.y)
      if (n.glow.active) n.glow.setPosition(n.obj.x, n.obj.y)
    }
  }

  // ── Abby star ability ─────────────────────────────────────────────────────────

  private spawnAbbyStars(src: Player) {
    src.swingMelee()
    // Gather all live targets sorted by distance
    const allTargets = [
      ...this.enemies.filter(e => e.active),
      ...(this.boss?.active ? [this.boss] : []),
    ].sort((a, b) =>
      Phaser.Math.Distance.Between(src.x, src.y, a.x, a.y) -
      Phaser.Math.Distance.Between(src.x, src.y, b.x, b.y)
    ) as Phaser.GameObjects.Sprite[]

    if (allTargets.length === 0) return

    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 90, () => {
        if (!src.active) return

        const target = allTargets.find(t => t.active) ?? null
        if (!target) return

        const star = this.add.text(
          src.x + Phaser.Math.Between(-18, 18),
          src.y - Phaser.Math.Between(10, 40),
          '★', {
            fontSize: '38px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffd700',
            stroke: '#aa6600',
            strokeThickness: 3,
          }
        ).setOrigin(0.5).setDepth(12)

        this.physics.add.existing(star)
        const body = star.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)

        const angle = Phaser.Math.Angle.Between(star.x, star.y, target.x, target.y)
        body.setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500)
        this.tweens.add({ targets: star, angle: 360, duration: 400, repeat: -1 })

        // Glowing shooting-star trail that follows the star automatically
        const trail = this.add.particles(star.x, star.y, '__DEFAULT', {
          lifespan: 300,
          speed: 0,
          scale: { start: 0.35, end: 0 },
          alpha: { start: 0.85, end: 0 },
          tint: [0xffd700, 0xffeeaa, 0xffffff, 0xff8800],
          quantity: 2,
          frequency: 18,
          blendMode: 'ADD',
        }).setDepth(11)
        trail.startFollow(star)

        let didHit = false
        const destroyTrail = () => { trail.stopFollow(); trail.destroy() }
        const onHit = () => {
          if (didHit || !star.active) return
          didHit = true
          destroyTrail()
          if (target === this.boss) {
            if (this.cfg.bossDefeatedKey === 'celeryManDefeated' &&
                (!this.registry.get('dadSaved') || !this.registry.get('momSaved'))) return
            SoundManager.bossHit()
            this.boss!.hit()
          } else {
            SoundManager.enemyHit()
            ;(target as Enemy).hit()
            this.addScore(SCORE_ENEMY)
          }
          this.tweens.add({
            targets: star, alpha: 0, scaleX: 2, scaleY: 2,
            duration: 150, onComplete: () => { if (star.active) star.destroy() },
          })
        }

        for (const e of this.enemies) {
          if (e === target) { this.physics.add.overlap(star, e, onHit); break }
        }
        if (target === this.boss && this.boss?.active) {
          this.physics.add.overlap(star, this.boss, onHit)
        }

        this.time.delayedCall(3000, () => {
          if (!star.active) return
          destroyTrail()
          this.tweens.add({ targets: star, alpha: 0, duration: 200, onComplete: () => { if (star.active) star.destroy() } })
        })
      })
    }
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
    else if (src.charKey === 'abby') this.spawnAbbyStars(src)
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
    const isFire = enemy.abilityType === AbilityType.Fire
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
    this.registry.set('wormCount', 0)
    this.registry.set('rolyPolyCount', 0)
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
    SoundManager.stopTrack()
    SoundManager.startCutsceneMusic()

    // Immediately black — no fade so the game world is never visible behind the cutscene
    this.cameras.main.setBackgroundColor('#000000')
    const bg = this.add.rectangle(cx, cy, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(200)

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
      // Scale to fit slot while keeping aspect ratio (letterbox)
      const scale = Math.min(slotW / img.width, height / img.height)
      img.setScale(scale)
      elements.push(img)
      this.tweens.add({ targets: img, alpha: 1, duration: 400, delay: 200 })
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
        SoundManager.stopCutsceneMusic()
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
    SoundManager.stopTrack()
    SoundManager.startCutsceneMusic()

    // Fully opaque black — hides the game world completely
    const bg = this.add.rectangle(cx, cy, width, height, 0x000000, 1)
      .setScrollFactor(0).setDepth(90)

    const title = this.add.text(cx, cy - 110, 'BOSS DEFEATED!', {
      fontSize: '28px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91).setAlpha(0)

    const sub = this.add.text(cx, cy - 55, 'What will you do?', {
      fontSize: '11px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91).setAlpha(0)

    const makeBtn = (x: number, label: string, cb: () => void) => {
      const btn = this.add.text(x, cy + 30, label, {
        fontSize: '10px', fontFamily: FONT, color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
        backgroundColor: '#00000066', padding: { x: 16, y: 12 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(91)
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
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(92).setVisible(false)

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
      SoundManager.stopCutsceneMusic()
    }
    this.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, gpHandler)

    // Fade in content (not the bg — that's instantly black)
    this.tweens.add({ targets: [title, sub, btnContinue, btnMenu], alpha: 1, duration: 400, delay: 100 })

    // Show cursor on first button after content is visible
    this.time.delayedCall(550, () => moveFocus(0))
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
    if (Phaser.Input.Keyboard.JustDown(keys['ability'])) p.useCharacterAbility()
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
        if (button.index === 9) { this.togglePause(); return }

        // D-pad navigates pause menu when paused
        if (!this.gm.isPlaying()) {
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
      this.registry.set('wormCount',            0)
      this.registry.set('rolyPolyCount',        0)
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
