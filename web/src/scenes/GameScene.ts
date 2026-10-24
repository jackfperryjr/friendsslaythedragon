import Phaser from 'phaser'
import { Player } from '../game/Player'
import { Enemy } from '../game/Enemy'
import { Boss } from '../game/Boss'
import { Destructible } from '../game/Destructible'
import { Mimic } from '../game/Mimic'
import { GameManager } from '../game/GameManager'
import { resetRunState, STARTING_LIVES } from '../game/runState'
import { canSpellWord, assignLetterBugLetters, makeMathProblem } from '../game/puzzles'
import { saveRun, clearSavedRun } from '../game/savedRun'
import { setSoundMuted, recordScore } from '../game/settings'
import { UIManager } from '../ui/UIManager'
import { TouchControls } from '../ui/TouchControls'
import { InputReader, InputFrame } from '../input/InputReader'
import { CharacterAbility, createAbility } from '../game/abilities/CharacterAbility'
import { onKeyPress } from '../input/keys'
import { PuzzleMenu } from '../ui/PuzzleMenu'
import { MenuNav } from '../ui/MenuNav'
import { ShopMenu, ShopItem } from '../ui/ShopMenu'
import { showBossCutscene, showPlaceholderCutscene, showBossDefeatedOverlay, showCongratulatoryOverlay } from '../ui/Cutscenes'
import { drawOutdoorSky, drawTorches, drawTileDepthShadows, paintOutdoorTiles, drawCastleDoor } from '../game/scenery'
import { RoomConfig, RoomNpcs, ExitDir, generateRun, TOTAL_LETTER_BUGS, WORD_LIST_L1, WORD_LIST_L2, WORD_LIST_L3, WORD_LIST_L4, WORD_LIST_L5 } from '../levels'
import { AbilityType, DamageType } from '../types'
import { ItemSpawn, ItemType } from '../levels'
import { SoundManager } from '../audio/SoundManager'

const FONT = '"Press Start 2P", monospace'
const SCORE_ENEMY = 200
const SCORE_DESTRUCT = 100


/** Player state carried between rooms (see persistPlayerState). */
interface PersistedBoosts {
  /** Boost time left in ms: 0 = none, -1 = permanent (JSON can't store Infinity) */
  speedMs: number
  strengthMs: number
  invulnMs: number
  /** @deprecated pre-feature-set-44 saves stored on/off flags; read as permanent */
  speedBoostActive?: boolean
  strengthBoostActive?: boolean
  invulnerabilityActive?: boolean
  isTruck: boolean
  isTrex: boolean
  hasShadow: boolean
  isDinoForm: boolean
  carterAbility: 'duplicate' | 'dino'
  conradAbility: 'truck' | 'transform'
  isConradTransformed: boolean
}

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

  player!: Player
  /** The chosen character's special moves (game/abilities/) */
  ability!: CharacterAbility
  enemies: Enemy[] = []
  private mimics:  Mimic[]  = []
  boss: Boss | null = null
  boss2: Boss | null = null
  private boss2Defeated = false
  private enemyGroup!: Phaser.Physics.Arcade.Group
  destructibles: Destructible[] = []
  private crates: Phaser.Physics.Arcade.Image[] = []
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group
  private bossProjectiles!: Phaser.Physics.Arcade.Group

  platforms!: Phaser.Physics.Arcade.StaticGroup
  private spikeBalls: Phaser.Physics.Arcade.Image[] = []
  private spikeFloorTiles: Phaser.Physics.Arcade.Image[] = []
  private cameraTarget!: Phaser.GameObjects.Rectangle
  private bossPortalPos: { x: number; y: number } | null = null
  private portalLabel: Phaser.GameObjects.Text | null = null
  private roomTransitioning = false
  private bossDefeated = false
  private bossRoomLeftBarrier: Phaser.GameObjects.Rectangle | null = null
  private bossRoomRightBarrier: Phaser.GameObjects.Rectangle | null = null
  private level2ExitPos:  { x: number; y: number } | null = null
  private backExitPos:    { x: number; y: number } | null = null
  private backPortalPos:    { x: number; y: number } | null = null
  private backPortalLbl:    Phaser.GameObjects.Text | null = null
  private hiddenPortalPos:  { x: number; y: number } | null = null
  private pauseNav!: MenuNav
  private shopMenu!: ShopMenu
  private puzzleMenu!: PuzzleMenu

  private collectibleSprites: (Phaser.GameObjects.Image | Phaser.GameObjects.Container)[] = []
  private celeryNpcX: number | null = null
  private shieldGfx!: Phaser.GameObjects.Graphics
  tilemapLayers: Phaser.Tilemaps.TilemapLayer[] = []
  private minimapDots: Phaser.GameObjects.Graphics | null = null

  private dadNpcSprite:   Phaser.GameObjects.Image | null = null
  private dadCageGfx:     Phaser.GameObjects.Graphics | null = null
  private dadCageBubble:  Phaser.GameObjects.Container | null = null
  private dadHintBubble:  Phaser.GameObjects.Container | null = null
  private momNpcSprite:   Phaser.GameObjects.Image | null = null
  private momCageGfx:     Phaser.GameObjects.Graphics | null = null
  private momCageBubble:  Phaser.GameObjects.Container | null = null
  private momHintBubble:  Phaser.GameObjects.Container | null = null

  private duckNpcSprite:  Phaser.GameObjects.Image | null = null
  private duckBubble:     Phaser.GameObjects.Container | null = null
  private wordDuckLevel:  number | null = null   // which level's word the duck asks for
  private arithDucks: { sprite: Phaser.GameObjects.Sprite; bubble: Phaser.GameObjects.Container | null; problemIdx: number; keyPrefix: string; solved: boolean }[] = []
  private exitBarrier: Phaser.GameObjects.Rectangle | null = null
  private _rightExitPopupLastTime = 0

  private inputReader!: InputReader
  private touchControls: TouchControls | null = null
  private pauseContainer!: Phaser.GameObjects.Container
  private score = 0
  private _lastPadConnected = false

  constructor() { super({ key: 'GameScene' }) }

  init() {
    this.enemies = []; this.mimics = []; this.destructibles = []
    this.crates = []; this.collectibleSprites = []; this.celeryNpcX = null
    this.dadHintBubble = null; this.momHintBubble = null
    this.tilemapLayers = []; this.spikeBalls = []; this.spikeFloorTiles = []
    this.touchControls = null
    this.score = 0
    this.boss = null
    this.boss2 = null
    this.boss2Defeated = false
    this.bossPortalPos = null
    this.portalLabel = null
    this.roomTransitioning = false
    this.bossDefeated = false
    this.bossRoomLeftBarrier = null
    this.bossRoomRightBarrier = null
    this.level2ExitPos = null
    this.backExitPos   = null
    this.backPortalPos   = null
    this.backPortalLbl   = null
    this.hiddenPortalPos = null
    this._lastPadConnected = false
    this.dadNpcSprite  = null
    this.dadCageGfx    = null
    this.dadCageBubble = null
    this.momNpcSprite  = null
    this.momCageGfx    = null
    this.momCageBubble = null
    this.duckNpcSprite = null
    this.duckBubble    = null
    this.wordDuckLevel = null
    this.arithDucks    = []
    this.exitBarrier   = null
    this._rightExitPopupLastTime = 0
  }

  /** Works out which room this is and loads its map if it isn't cached yet. */
  preload() {
    this.resolveRoom()
    const wm = this.cfg.worldMap
    if (!wm) return
    const needMap = !this.cache.tilemap.exists(wm.key)
    const needTiles = !this.textures.exists(wm.tileKey)
    if (!needMap && !needTiles) return
    if (needMap)   this.load.tilemapTiledJSON(wm.key, `maps/${wm.folder}/map.json`)
    if (needTiles) this.load.image(wm.tileKey, `maps/${wm.folder}/spritesheet.png`)
    const { width, height } = this.scale
    const label = this.add.text(width / 2, height / 2, 'LOADING...', {
      fontSize: '14px', fontFamily: FONT, color: '#7799aa',
    }).setOrigin(0.5)
    this.load.once(Phaser.Loader.Events.COMPLETE, () => label.destroy())
  }

  /** Picks this run's current room (creating the run if there isn't one). */
  private resolveRoom() {
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
  }

  create() {
    this.score = this.registry.get('score') ?? 0
    if (!this.registry.get('runStartTime')) this.registry.set('runStartTime', Date.now())
    this.gm = new GameManager()
    this.puzzleMenu = new PuzzleMenu(this, {
      pause:  () => { this.gm.pause();  this.physics.world.isPaused = true },
      resume: () => { this.gm.resume(); this.physics.world.isPaused = false },
    })

    const W = this.cfg.worldWidth
    const H = this.cfg.worldHeight ?? 720
    this.physics.world.setBounds(-100, -100, W + 200, H + 200)
    this.cameras.main.setBounds(0, 0, W, H)
    this.cameras.main.setRoundPixels(true)

    drawOutdoorSky(this, this.cfg)
    this.initLevelWords()
    this.buildLevel()
    this.setupCollectibles()
    this.spawnPlayer()
    this.setupCollision()
    this.setupGamepadEvents()
    this.setupCamera()

    const _bossAlreadyDefeated = !!(this.cfg.bossDefeatedKey && this.registry.get(this.cfg.bossDefeatedKey))
    this.ui = new UIManager(
      this,
      this.cfg.name,
      (this.cfg.isBossRoom ?? false) && !_bossAlreadyDefeated,
      this.cfg.bossHp ?? 0,
      this.cfg.bossName ?? 'BOSS',
      this.cfg.boss2Hp ?? 0,
      this.cfg.boss2Name ?? '',
    )

    if (this.boss) {
      this.boss.on('hpChanged', (hp: number, max: number) => this.ui.updateBossBar(hp, max))
      if (!this.cfg.bossNoAttack) this.boss.on('bossAttack', (ability: AbilityType) => this.fireBossSpecial(ability))
      this.ui.updateBossBar(this.cfg.bossHp!, this.cfg.bossHp!)
    }
    if (this.boss2) {
      this.boss2.on('hpChanged', (hp: number, max: number) => this.ui.updateBoss2Bar(hp, max))
      this.ui.updateBoss2Bar(this.cfg.boss2Hp!, this.cfg.boss2Hp!)
    }

    this.restorePlayerState()
    this.ui.updateLetters(this.registry.get('collectedLetters') ?? [])
    this.ui.updateCoinCount(this.registry.get('goldCoins') ?? 0)
    this.ui.updateLives(this.registry.get('lives') ?? STARTING_LIVES)
    this.ui.updateScore(this.score)
    this.buildNPCs()
    drawTorches(this, this.cfg, (x, y) => this.isInsideWall(x, y))
    this.buildPauseMenu()
    this.buildMapOverlay()
    onKeyPress(this, e => { if (e.code === 'Escape') this.togglePause() })
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const defeatedKey = this.cfg.bossDefeatedKey
    const isBossRoomLive = this.cfg.isBossRoom && !(defeatedKey && this.registry.get(defeatedKey))
    const trackKey = isBossRoomLive
      ? (this.cfg.bossMusicKey ?? 'music-boss')
      : (this.cfg.musicKey    ?? 'music-gameplay')
    SoundManager.startTrack(this.sound, trackKey)

    // Entering a room is a save point: CONTINUE on the main menu resumes here
    saveRun(this.registry, this.cfg.name)
  }

  // ── background ──────────────────────────────────────────────────────────────

  // ── collectibles ──────────────────────────────────────────────────────────────

  private isInsideWall(x: number, y: number): boolean {
    return this.tilemapLayers.some(layer => {
      const tile = layer.getTileAtWorldXY(x, y)
      return tile !== null && tile.index >= 0
    })
  }

  private setupCollectibles() {
    const isInsideWall = (x: number, y: number) => this.isInsideWall(x, y)

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const letterBugIdx: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
    const placedBugPositions: Array<{ x: number; y: number }> = []
    const BUG_MIN_DIST = 80
    const CLEAR = 22
    const clearOf = (x: number, y: number) =>
      !isInsideWall(x - CLEAR, y) && !isInsideWall(x + CLEAR, y) &&
      !isInsideWall(x, y - CLEAR) && !isInsideWall(x, y + CLEAR)
    const goodPos = (x: number, y: number) => !isInsideWall(x, y) && clearOf(x, y)
    // Scan downward from approxY to place bug just above the first solid floor tile.
    // Returns null in non-tilemap rooms (goodPos fallback handles those).
    const snapBugToFloor = (wx: number, approxY: number): { x: number; y: number } | null => {
      if (this.tilemapLayers.length === 0) return null
      let sy = approxY
      for (let i = 0; i < 60 && this.isInsideWall(wx, sy); i++) sy -= 8  // escape upward if in wall
      if (this.isInsideWall(wx, sy)) return null
      for (let y = sy; y < sy + 800; y += 4) {
        if (this.isInsideWall(wx, y)) return { x: wx, y: y - 24 }
      }
      return null
    }
    for (const item of this.cfg.items) {
      // Letter-bugs bypass this check — their position is resolved below with pool/fallback logic
      if (item.type !== 'letter-bug' && isInsideWall(item.x, item.y)) continue

      // Key jar: breakable destructible — player attacks break it and drop the key
      if (item.type === 'key-jar') {
        const alreadyHaveKey = !!(this.registry.get(`hasLevel${item.keyLevel ?? 1}Key`))
        if (!alreadyHaveKey) this.spawnKeyJar(item.x, item.y, item.keyLevel ?? 1)
        continue
      }

      // Letter bug: colored beetle with a letter on its back
      if (item.type === 'letter-bug') {
        const kl = item.keyLevel ?? 1
        // Don't re-spawn once this level's duck puzzle is solved
        if (this.isLetterLevelSolved(kl)) continue
        const idx = letterBugIdx[kl] ?? 0
        letterBugIdx[kl] = idx + 1
        const storedPositions: Array<{x: number, y: number}> | null = this.registry.get(`level${kl}BugPositions`)
        const poolPos = storedPositions?.[idx]
        // Primary: snap to walkable floor surface (tilemap rooms)
        const snapped = snapBugToFloor(item.x, item.y)
        let bugX: number
        let bugY: number
        if (snapped) {
          bugX = snapped.x
          bugY = snapped.y
        } else {
          // Non-tilemap room: prefer pool position, fall back to config, then escape from walls
          bugX = (poolPos && goodPos(poolPos.x, poolPos.y)) ? poolPos.x : item.x
          bugY = (poolPos && goodPos(poolPos.x, poolPos.y)) ? poolPos.y : item.y
          if (!goodPos(bugX, bugY)) {
            const escapeOffsets: [number, number][] = [
              [0, -32], [0, -64], [0, -96], [0, -128],
              [-32, -32], [32, -32], [-32, 0], [32, 0],
              [-64, 0], [64, 0], [0, 32], [0, 64],
            ]
            for (const [ox, oy] of escapeOffsets) {
              if (goodPos(bugX + ox, bugY + oy)) { bugX += ox; bugY += oy; break }
            }
          }
        }
        // Spread bugs that landed too close to an already-placed bug
        if (placedBugPositions.some(p => Math.hypot(bugX - p.x, bugY - p.y) < BUG_MIN_DIST)) {
          const spreadOffsets: [number, number][] = [
            [-96, 0], [96, 0], [0, -96], [0, 96],
            [-128, 0], [128, 0], [-64, -64], [64, -64], [-64, 64], [64, 64],
          ]
          for (const [ox, oy] of spreadOffsets) {
            const nx = bugX + ox, ny = bugY + oy
            if (goodPos(nx, ny) && !placedBugPositions.some(p => Math.hypot(nx - p.x, ny - p.y) < BUG_MIN_DIST)) {
              bugX = nx; bugY = ny; break
            }
          }
        }
        placedBugPositions.push({ x: bugX, y: bugY })
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
      this.showPopup(item.x, item.y, '+PIZZA', '#ff4d6a')
      SoundManager.collectHeart()
      if (item.type === 'pizza') this.registry.set('pizzasCollected', (this.registry.get('pizzasCollected') ?? 0) + 1)
    } else if (item.type === 'life') {
      const lives: number = (this.registry.get('lives') ?? 1) + 1
      this.registry.set('lives', lives)
      this.ui.updateLives(lives)
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
      const kl = item.keyLevel ?? 1
      const collected: string[] = [...(this.registry.get('collectedLetters') ?? [])]
      collected.push(letter)
      this.registry.set('collectedLetters', collected)
      if (kl >= 3) {
        const lN: string[] = [...(this.registry.get(`level${kl}CollectedLetters`) ?? [])]
        lN.push(letter)
        this.registry.set(`level${kl}CollectedLetters`, lN)
      }
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
      // Clear the shared letter pool now that the puzzle is solved
      this.registry.set('collectedLetters', [])
      this.ui.updateLetters([])
      this.showPopup(item.x, item.y, 'YOU FOUND A KEY!', '#ffdd00')
      SoundManager.collectAbility()
    } else if (item.type === 'gold-coin') {
      const coins: number = (this.registry.get('goldCoins') ?? 0) + 1
      this.registry.set('goldCoins', coins)
      this.showPopup(item.x, item.y, 'COIN!', '#ffd700')
      SoundManager.collectHeart()
      this.ui?.updateCoinCount(coins)
      return  // no score bonus for coins
    }
    this.addScore(500)
  }

  private resetRoomLetterBugs() {
    const bugItem = this.cfg?.items.find(i => i.type === 'letter-bug')
    if (!bugItem) return
    const kl = bugItem.keyLevel ?? 1
    if (!this.isLetterLevelSolved(kl)) {
      this.registry.set('collectedLetters', null)
      if (kl >= 3) this.registry.set(`level${kl}CollectedLetters`, null)
    }
  }

  /** Levels whose word is solved at a magic jar (it drops a key); the rest are solved by a duck. */
  private static readonly JAR_LEVELS = [1, 2, 4, 8, 9, 10]

  /** Has the word puzzle for this letter-bug level been solved? */
  private isLetterLevelSolved(kl: number): boolean {
    return GameScene.JAR_LEVELS.includes(kl)
      ? !!this.registry.get(`hasLevel${kl}Key`)
      : !!this.registry.get(`level${kl}WordSolved`)
  }

  /** Levels 1-2 share one letter pool; level 3+ keep their own so letters don't mix. */
  private collectedLettersKey(kl: number): string {
    return kl >= 3 ? `level${kl}CollectedLetters` : 'collectedLetters'
  }

  private clearLetterBugs() {
    const remaining: Phaser.GameObjects.GameObject[] = []
    for (const s of this.collectibleSprites) {
      if ((s as Phaser.GameObjects.Container).getData?.('item')?.type === 'letter-bug') {
        s.destroy()
      } else {
        remaining.push(s)
      }
    }
    this.collectibleSprites = remaining as (Phaser.GameObjects.Image | Phaser.GameObjects.Container)[]
    this.registry.set('collectedLetters', [])
    this.ui?.updateLetters([])
  }

  private triggerMysteryEffect(player: Player) {
    const isGood = Math.random() < 0.5
    if (isGood) {
      const r = Math.floor(Math.random() * 3)
      if (r === 0) {
        player.hearts = Math.min(5, player.hearts + 1)
        this.showPopup(player.x, player.y - 32, '+ PIZZA!', '#ff4d6a')
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
      this.watchEnemy(enemy)
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
    const dk = this.cfg.bossDefeatedKey
    // Story NPCs for this room come from its config (RoomConfig.npcs)
    const byConfig: Record<RoomNpcs, () => void> = {
      'castle-intro': () => this.buildWorldOneNPCs(),
      'level2-intro': () => this.buildLevel2IntroDuck(),
      'level3':       () => this.buildLevel3Duck(),
      'level4':       () => this.buildLevel4NPCs(),
      'level5':       () => this.buildLevel5NPCs(),
      'level6':       () => this.buildLevel6NPCs(),
      'level7':       () => this.buildLevel7NPCs(),
    }
    if (this.cfg.npcs && !this.cfg.isBossRoom) byConfig[this.cfg.npcs]()
    else if (dk === 'skeletonKingDefeated') this.buildSkeletonKingNPCs()
    else if (dk === 'zombieKingDefeated') this.buildZombieKingNPCs()
    else if (dk === 'celeryManDefeated') this.buildCeleryManNPCs()
    if (this.cfg.isRed    && !this.cfg.isBossRoom) this.buildLevelOneNPCs()
    if (this.cfg.isOrange && !this.cfg.isBossRoom) this.buildLevelTwoNPCs()
    if (this.cfg.isSunset && !this.cfg.isBossRoom) { this.buildLevel3WorldNPCs(); this.buildSunsetArithDucks() }
    if (this.cfg.isGreen  && !this.cfg.isBossRoom) this.buildGreenHallsNPCs()
    if (this.cfg.isBlue   && !this.cfg.isBossRoom) this.buildLevelFiveNPCs()
  }

  private buildLevelFiveNPCs() {
    const mx = 1362, my = 2684
    this.add.image(mx, my, 'npc-mom', 12).setDepth(2).setScale(1.5).setFlipX(true)
    this.showNpcBubble(mx, my - 90, [
      'Find the letter bugs',
      'hidden in the halls!',
      'The magic jar holds',
      'the secret word.',
    ], null)
  }

  private buildWorldOneNPCs() {
    this.add.sprite(602, 892, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5).setFlipX(true)
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

  // Informational duck near the level 2 entry (player spawns around x=314)
  private buildLevel2IntroDuck() {
    const dx = 471, dy = 3356
    this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(dx, dy - 90, [
      'Welcome to Level 2!',
      'Words are 4 letters',
      'here. Find the',
      'letter bugs!',
    ], null)
  }

  // Duck gatekeeper sits left of the Celery Man boss portal in LEVEL3_WORLD_ROOM
  // bossPortal is at x=517, y=672 — duck stands at x=410, y=672
  private buildLevel3Duck() {
    // Entry-side informational duck near right spawn (x=5300, y=608)
    const ix = 5100, iy = 608
    this.add.sprite(ix, iy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5).setFlipX(true)
    this.showNpcBubble(ix, iy - 90, [
      'Welcome to Level 3!',
      'Words are 5 letters.',
      'Find the bugs, then',
      'talk to my friend',
      'by the lair door!',
    ], null)

    // Gatekeeper duck left of boss portal (x=517, y=672) — only if not yet solved
    if (this.registry.get('level3WordSolved')) return
    const dx = 410, dy = 672
    this.duckNpcSprite = this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.6).setFlipX(true)
    this.duckBubble = this.showNpcBubble(dx, dy - 90, ['Solve my word', 'puzzle to enter', 'the Celery Lair!'], null)
    this.wordDuckLevel = 3
  }

  /** Word-puzzle duck (levels 3, 5, 6, 7): talk to it with all the letters to solve its word. */
  private updateWordDuck(input: InputFrame) {
    const level = this.wordDuckLevel
    if (level === null || !this.duckNpcSprite?.active) return
    const duck = this.duckNpcSprite
    const word: string = this.registry.get(`level${level}Word`) ?? ''
    const collected: string[] = this.registry.get(`level${level}CollectedLetters`) ?? []
    const ready = !!(word && canSpellWord(word, collected))

    // Swap the bubble text when the player gathers the last letter
    if (this.duckBubble?.active) {
      const wasReady: boolean = this.duckBubble.getData('ready') ?? false
      if (ready !== wasReady) {
        this.duckBubble.destroy()
        this.duckBubble = this.showNpcBubble(duck.x, duck.y - 90,
          ready ? ['You have all', 'the letters!', 'Tell me the word!'] : ['Find all the', 'letter bugs first!'],
          null,
        )
        this.duckBubble.setData('ready', ready)
      }
    }

    const p = this.player
    if (!p.isAlive || !input.talkPressed) return
    if (Phaser.Math.Distance.Between(p.x, p.y, duck.x, duck.y) > 90) return

    if (!ready) {
      const existing = duck.getData('alertBubble') as Phaser.GameObjects.Container | undefined
      if (!existing?.active) {
        const b = this.showNpcBubble(duck.x, duck.y - 185, ['You need all', `${word.length} letters!`], 2500)
        duck.setData('alertBubble', b)
      }
      return
    }

    this.showWordMenu(duck.x, duck.y, level, () => {
      this.registry.set(`level${level}WordSolved`, true)
      this.registry.set(`level${level}CollectedLetters`, [])
      if (this.exitBarrier) {
        ;(this.exitBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = false
        this.exitBarrier.destroy(); this.exitBarrier = null
      }
      if (duck.active) {
        this.tweens.add({
          targets: duck, y: duck.y - 30, alpha: 0, duration: 600,
          onComplete: () => { duck.destroy(); this.duckNpcSprite = null },
        })
      }
      this.duckBubble?.destroy(); this.duckBubble = null
      this.wordDuckLevel = null
    })
  }

  /** Math ducks (level 4 and the sunset fields): solve a sum for gold coins. */
  private updateArithDucks(input: InputFrame) {
    const p = this.player
    if (!p.isAlive || !input.talkPressed) return
    for (const duck of this.arithDucks) {
      if (!duck.sprite.active || duck.solved) continue
      if (Phaser.Math.Distance.Between(p.x, p.y, duck.sprite.x, duck.sprite.y) > 90) continue
      const prob = this.registry.get(`${duck.keyPrefix}${duck.problemIdx}`) as { q: string; answer: number } | null
      if (!prob) continue
      this.showArithmeticMenu(duck.sprite.x, duck.sprite.y, prob.q, prob.answer, () => {
        duck.solved = true
        this.registry.set(`${duck.keyPrefix}${duck.problemIdx}Solved`, true)
        const coinReward = Phaser.Math.Between(100, 300)
        const totalCoins = (this.registry.get('goldCoins') ?? 0) + coinReward
        this.registry.set('goldCoins', totalCoins)
        this.ui?.updateCoinCount(totalCoins)
        this.showPopup(duck.sprite.x, duck.sprite.y, `+${coinReward} COINS!`, '#ffd700')
        duck.bubble?.destroy(); duck.bubble = null
        this.tweens.add({
          targets: duck.sprite, y: duck.sprite.y - 30, alpha: 0, duration: 600,
          onComplete: () => { duck.sprite.destroy() },
        })
      })
      break
    }
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
      this.add.sprite(npcX, npcY, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5).setFlipX(true)
      this.showNpcBubble(npcX, npcY - 90, [
        'You cannot defeat',
        'Celery Man without',
        'saving Mom & Dad first!',
      ], null)
    }
  }

  buildLevelTwoNPCs() {
    const dx = 962, dy = 3004
    this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(dx, dy - 90, [
      'Find 6 letter bugs',
      'hidden in the halls!',
      'Spell the word at',
      'the magic jar, then',
      'enter the boss door!',
    ], null)
  }

  buildLevel3WorldNPCs() {
    const dx = 1710, dy = 1820
    this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(dx, dy - 90, [
      'The Sunset Fields!',
      'Find 5 math ducks',
      'to earn boosts!',
    ], null)
  }

  buildLevelOneNPCs() {
    const dx = 705, dy = 604
    this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(dx, dy - 90, [
      'Welcome to the Red Halls!',
      'Find 6 letter bugs',
      'hidden in the level.',
      'Solve the magic jar',
      'to unlock the door!',
    ], null)
  }

  private buildGreenHallsNPCs() {
    const dx = 766, dy = 6268
    this.add.image(dx, dy, 'npc-dad', 8).setDepth(2).setScale(1.5)
    this.showNpcBubble(dx, dy - 90, [
      'The Green Halls!',
      'Find letter bugs,',
      'solve the magic jar,',
      'then enter the door!',
    ], null)
  }

  private buildLevel4NPCs() {
    // Instructional duck at spawn point
    const sx = 356, sy = 1628
    this.add.sprite(sx, sy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(sx, sy - 90, [
      'Welcome to Level 4!',
      'Find 3 ducks and',
      'solve their math',
      'problems for coins!',
    ], null)

    // Arithmetic ducks — one per problem, spread across the level
    const positions = [
      { x: 1500, y: 1628 },
      { x: 5848, y: 1212 },
      { x: 8668, y:  860 },
    ]
    for (let i = 0; i < 3; i++) {
      if (this.registry.get(`level4Problem${i + 1}Solved`)) continue
      const { x, y } = positions[i]
      const duck = this.add.sprite(x, y, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5).setFlipX(true)
      const bubble = this.showNpcBubble(x, y - 90, ['Reward: Gold Coins!', 'Solve my math', 'problem!'], null)
      this.arithDucks.push({ sprite: duck, bubble, problemIdx: i + 1, keyPrefix: 'level4Problem', solved: false })
    }
  }

  private buildSunsetArithDucks() {
    // Scan the full column to find the floor surface closest to approxY
    const snapToFloor = (wx: number, approxY: number): number => {
      if (this.tilemapLayers.length === 0) return approxY
      const worldH = this.cfg.worldHeight ?? 2208
      let best = approxY, bestDist = Infinity, prevWall = false
      for (let y = 0; y <= worldH; y += 4) {
        const inWall = this.isInsideWall(wx, y)
        if (inWall && !prevWall) {
          const floorY = y - 24
          const dist = Math.abs(floorY - approxY)
          if (dist < bestDist) { best = floorY; bestDist = dist }
        }
        prevWall = inWall
      }
      return best
    }
    const xPositions = [2800, 4600, 6500, 8400, 10100]
    for (let i = 0; i < 5; i++) {
      if (this.registry.get(`sunsetProblem${i + 1}Solved`)) continue
      const x = xPositions[i]
      const y = snapToFloor(x, 2012)
      const duck = this.add.sprite(x, y, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5).setFlipX(true)
      const bubble = this.showNpcBubble(x, y - 90, ['Reward: Gold Coins!', 'Solve my math', 'problem!'], null)
      this.arithDucks.push({ sprite: duck, bubble, problemIdx: i + 1, keyPrefix: 'sunsetProblem', solved: false })
    }
  }

  private buildLevel5NPCs() {
    // Instructional duck at spawn
    const sx = 467, sy = 348
    this.add.sprite(sx, sy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(sx, sy - 90, [
      'Welcome to Level 5!',
      '7-letter words here.',
      'Find letter bugs,',
      'then talk to my',
      'friend by the exit!',
    ], null)

    // Puzzle duck near right exit (x≈3115)
    if (this.registry.get('level5WordSolved')) return
    const dx = 3065, dy = 1724
    this.duckNpcSprite = this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.6).setFlipX(true) as unknown as Phaser.GameObjects.Image
    this.duckBubble = this.showNpcBubble(dx, dy - 90, ['Solve my word', 'puzzle to pass!'], null)
    this.wordDuckLevel = 5

    // Invisible barrier between duck and exit — removed when puzzle is solved
    const H = this.cfg.worldHeight ?? 1856
    const barrier = this.add.rectangle(3095, H / 2, 32, H, 0x000000, 0)
    this.physics.add.existing(barrier, true)
    this.platforms.add(barrier as unknown as Phaser.Physics.Arcade.Image)
    this.exitBarrier = barrier
  }

  private buildLevel6NPCs() {
    // Instructional duck at spawn (bottom-left x=204, y=1724)
    const sx = 304, sy = 1724
    this.add.sprite(sx, sy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(sx, sy - 90, [
      'Welcome to Level 6!',
      '7-letter words here.',
      'Find letter bugs,',
      'then talk to my',
      'friend by the exit!',
    ], null)

    // Puzzle duck near right exit (x≈3106)
    if (this.registry.get('level6WordSolved')) return
    const dx = 3056, dy = 1724
    this.duckNpcSprite = this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.6).setFlipX(true) as unknown as Phaser.GameObjects.Image
    this.duckBubble = this.showNpcBubble(dx, dy - 90, ['Solve my word', 'puzzle to pass!'], null)
    this.wordDuckLevel = 6

    // Invisible barrier between duck and exit — removed when puzzle is solved
    const H = this.cfg.worldHeight ?? 1856
    const barrier = this.add.rectangle(3082, H / 2, 32, H, 0x000000, 0)
    this.physics.add.existing(barrier, true)
    this.platforms.add(barrier as unknown as Phaser.Physics.Arcade.Image)
    this.exitBarrier = barrier
  }

  private buildLevel7NPCs() {
    // Instructional duck at spawn (bottom-left x=204, y=1724)
    const sx = 304, sy = 1724
    this.add.sprite(sx, sy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.5)
    this.showNpcBubble(sx, sy - 90, [
      'Welcome to Level 7!',
      '7-letter words here.',
      'Find letter bugs,',
      'then talk to my',
      'friend by the boss',
      'door to enter!',
    ], null)

    // Puzzle duck near boss portal (bossPortal at x=1630, y=604)
    if (this.registry.get('level7WordSolved')) return
    const dx = 1530, dy = 610
    this.duckNpcSprite = this.add.sprite(dx, dy, 'npc-duck').play('npc-duck-idle').setDepth(2).setScale(1.6).setFlipX(true) as unknown as Phaser.GameObjects.Image
    this.duckBubble = this.showNpcBubble(dx, dy - 90, ['Solve my word', 'puzzle to enter', 'the Dragon Lair!'], null)
    this.wordDuckLevel = 7
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

  /** Picks a word (and scatters its bugs) for the level this room hosts, and generates math problems. */
  private initLevelWords() {
    if (this.cfg.isBossRoom) return
    const reg = this.registry
    const scatterBugs = (kl: number, count: number) => {
      if (!this.cfg.letterBugPool) return
      const positions = (Phaser.Utils.Array.Shuffle([...this.cfg.letterBugPool]) as Array<{ x: number; y: number }>).slice(0, count)
      reg.set(`level${kl}BugPositions`, positions)
    }
    const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)]

    const kl = this.cfg.wordLevel
    if (kl !== undefined && kl <= 3 && !reg.get(`level${kl}Word`)) {
      // Levels 1-3: 3, 4 and 5-letter words, TOTAL_LETTER_BUGS bugs
      const word = pick([WORD_LIST_L1, WORD_LIST_L2, WORD_LIST_L3][kl - 1])
      reg.set(`level${kl}Word`, word)
      reg.set(`level${kl}BugLetters`, assignLetterBugLetters(word, TOTAL_LETTER_BUGS))
      scatterBugs(kl, TOTAL_LETTER_BUGS)
    }
    if (kl !== undefined && kl >= 5 && !reg.get(`level${kl}WordSolved`)) {
      // Levels 5-7: 7-letter words, one bug per letter
      const existingLetters = reg.get(`level${kl}BugLetters`) as string[] | null
      if (!reg.get(`level${kl}Word`) || !existingLetters || existingLetters.length !== 7) {
        const word = pick(WORD_LIST_L5)
        reg.set(`level${kl}Word`, word)
        reg.set(`level${kl}BugLetters`, assignLetterBugLetters(word, 7))
        reg.set(`level${kl}CollectedLetters`, null)
        scatterBugs(kl, 7)
      }
    }

    const math = this.cfg.mathDucks
    if (math && !reg.get(`${math.prefix}1`)) {
      for (let i = 1; i <= math.count; i++) reg.set(`${math.prefix}${i}`, makeMathProblem(i))
    }

    // Disconnected levels (halls): 6-letter words, 6 bugs
    for (const kl of [4, 8, 9, 10] as const) {
      if (!this.cfg.isBossRoom && !this.registry.get(`level${kl}BugLetters`) &&
          this.cfg.items.some(i => i.type === 'letter-bug' && i.keyLevel === kl)) {
        const word = WORD_LIST_L4[Math.floor(Math.random() * WORD_LIST_L4.length)]
        this.registry.set(`level${kl}Word`, word)
        this.registry.set(`level${kl}BugLetters`, assignLetterBugLetters(word, 6))
        if (this.cfg.letterBugPool) {
          const positions = (Phaser.Utils.Array.Shuffle([...this.cfg.letterBugPool]) as Array<{x: number, y: number}>).slice(0, 6)
          this.registry.set(`level${kl}BugPositions`, positions)
        }
      }
    }
  }

  private updateParentHints() {
    const PROX = 140

    const handleParent = (
      sprite:    Phaser.GameObjects.Image | null,
      bossKey:   string,
      keyReg:    string,
      freeFn:    () => void,
      bubble:    Phaser.GameObjects.Container | null,
      setBubble: (b: Phaser.GameObjects.Container | null) => void,
    ) => {
      if (!sprite?.active) return
      const bossOk = !!(this.registry.get(bossKey))
      const keyOk  = !!(this.registry.get(keyReg))
      const p      = this.player
      const near   = p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, sprite.x, sprite.y) < PROX

      if (bossOk && keyOk && near) {
        if (bubble?.active) { bubble.destroy(); setBubble(null) }
        freeFn()
        return
      }

      if (!bossOk) return

      if (near && !keyOk && !bubble?.active) {
        setBubble(this.showNpcBubble(sprite.x, sprite.y - 160, ['Find the magic jar!'], null))
      } else if (!near && bubble?.active) {
        bubble.destroy()
        setBubble(null)
      }
    }

    handleParent(
      this.dadNpcSprite, 'skeletonKingDefeated', 'hasLevel1Key',
      () => this.freeDad(),
      this.dadHintBubble, b => { this.dadHintBubble = b },
    )

    handleParent(
      this.momNpcSprite, 'zombieKingDefeated', 'hasLevel2Key',
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
    this.bossProjectiles  = this.physics.add.group()

    // ── Tilemap world: create Phaser tile layers, mark collision tiles ──────
    if (!this.cfg.worldMap) throw new Error(`Room "${this.cfg.name}" has no worldMap`)
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

    // Sunset rooms: lime-biased tint compensates for tiles' red channel so result reads yellow
    if (this.cfg.isSunset) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0x80e000)
      solidLayers.forEach(l  => tint(l,  0x90f000))
      overlayLayers.forEach(l => tint(l, 0xa8f820))
    }

    // Dark rooms (levels 5-7+): tint tile layers with grey/purple hues
    if (this.cfg.isDark) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0x404060)                        // dark purple-grey background
      solidLayers.forEach(l  => tint(l,  0x585878))  // medium grey-purple solids
      overlayLayers.forEach(l => tint(l, 0x686898))  // slightly lighter purple overlay
    }

    // Red rooms: tint tile layers with red hues
    if (this.cfg.isRed) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0xc07878)
      solidLayers.forEach(l  => tint(l,  0xd08888))
      overlayLayers.forEach(l => tint(l, 0xe09898))
    }

    // Orange rooms: tint tile layers with orange hues
    if (this.cfg.isOrange) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0xc08040)
      solidLayers.forEach(l  => tint(l,  0xd09050))
      overlayLayers.forEach(l => tint(l, 0xe0a060))
    }

    // Green rooms: tint tile layers with green hues
    if (this.cfg.isGreen) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0x408050)
      solidLayers.forEach(l  => tint(l,  0x509060))
      overlayLayers.forEach(l => tint(l, 0x60a070))
    }

    // Blue rooms: tint tile layers with blue hues
    if (this.cfg.isBlue) {
      const tint = (l: Phaser.Tilemaps.TilemapLayer | null, c: number) => { if (l) l.setTint(c) }
      tint(bgLayer, 0x5080c0)
      solidLayers.forEach(l  => tint(l,  0x6090d0))
      overlayLayers.forEach(l => tint(l, 0x78a8e0))
    }

    this.tilemapLayers = solidLayers.filter((l: Phaser.Tilemaps.TilemapLayer | null): l is Phaser.Tilemaps.TilemapLayer => l !== null)

    // Build explicit static bodies from tile data — guarantees collision even
    // when Phaser's built-in tilemap physics is unreliable at certain scales.
    this.tilemapLayers.forEach(l => this.addTileLayerBodies(l, SCALE, ox, oy))
    drawTileDepthShadows(this, this.tilemapLayers, Math.round(map.tileWidth * SCALE), Math.round(map.tileHeight * SCALE), ox, oy)

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

    const CLUSTER_DIST = 72
    const placedFurnPos: Array<{x: number, y: number}> = []
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
      if (placedFurnPos.some(p => Math.hypot(fs.x - p.x, furnY - p.y) < CLUSTER_DIST)) continue
      placedFurnPos.push({x: fs.x, y: furnY})
      const hp = fs.type === 'chest' ? 3 : fs.type === 'bookcase' ? 2 : 1
      const chestYOffset = fs.type === 'chest' && (this.cfg.isRed || this.cfg.isOrange) ? 10 : 0
      this.spawnFurniturePiece(fs.type, fs.x, furnY + chestYOffset, fs.ability ?? AbilityType.None, hp, {}, fs.pizzaDrop, fs.itemDrop)
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

    const placedEnemyPos: Array<{x: number, y: number}> = []
    for (const e of this.cfg.enemies) {
      if (placedEnemyPos.some(p => Math.hypot(e.x - p.x, e.y - p.y) < CLUSTER_DIST)) continue
      placedEnemyPos.push({x: e.x, y: e.y})
      const enemy = new Enemy(this, e.x, e.y, e.ability)
      this.watchEnemy(enemy)
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
        this.boss2Defeated = true
        const runRooms0: RoomConfig[] = this.registry.get('runRooms') ?? []
        const runIndex0: number       = this.registry.get('runIndex') ?? 0
        if (runIndex0 + 1 < runRooms0.length) this.openLevel2Exit(W)
      } else {
        // Seal both exits until all bosses die
        const barrierH = this.cfg.worldHeight ?? 720
        const barrier = this.add.rectangle(this.cfg.bossLeftBarrierX ?? 150, barrierH / 2, 20, barrierH, 0x000000, 0)
        this.physics.add.existing(barrier, true)
        this.platforms.add(barrier as unknown as Phaser.Physics.Arcade.Image)
        this.bossRoomLeftBarrier = barrier

        const rBarrier = this.add.rectangle(this.cfg.bossRightBarrierX ?? W - 150, this.cfg.bossRightBarrierY ?? barrierH / 2, 20, barrierH, 0x000000, 0)
        this.physics.add.existing(rBarrier, true)
        this.platforms.add(rBarrier as unknown as Phaser.Physics.Arcade.Image)
        this.bossRoomRightBarrier = rBarrier

        const NEW_BOSS_KEYS = ['pacDudeDefeated', 'mushroomManDefeated', 'fowserDefeated', 'duoDefeated']
        const dk = this.cfg.bossDefeatedKey

        // Callback shared by both single and dual-boss rooms once all bosses are dead
        const onAllBossesDead = () => {
          if (this.bossRoomLeftBarrier) {
            ;(this.bossRoomLeftBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = false
            this.bossRoomLeftBarrier = null
          }
          if (this.bossRoomRightBarrier) {
            ;(this.bossRoomRightBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = false
            this.bossRoomRightBarrier = null
          }
          if (dk) this.registry.set(dk, true)
          this.ui.hideBossBar()
          // Save the win right away so quitting now doesn't mean fighting the boss again
          this.persistPlayerState()
          saveRun(this.registry, this.cfg.name)

          const coinReward = Phaser.Math.Between(100, 300)
          const totalCoins = (this.registry.get('goldCoins') ?? 0) + coinReward
          this.registry.set('goldCoins', totalCoins)
          this.ui.updateCoinCount(totalCoins)
          this.showPopup(this.cfg.worldWidth / 2, 320, `+${coinReward} COINS!`, '#ffd700')

          const runRooms: RoomConfig[] = this.registry.get('runRooms') ?? []
          const runIndex: number       = this.registry.get('runIndex') ?? 0
          const hasCutscene = dk === 'skeletonKingDefeated' || dk === 'zombieKingDefeated'
          const cutsceneSuffix = dk === 'skeletonKingDefeated' ? 'skeleton_king' : 'zombie_king'

          if (hasCutscene) {
            showBossCutscene(this, cutsceneSuffix, () => {
              if (this.cfg.backPortal) this.buildBackPortal()
              if (runIndex + 1 < runRooms.length) this.openLevel2Exit(W)
              else showBossDefeatedOverlay(this)
            })
          } else if (dk === 'celeryManDefeated') {
            showPlaceholderCutscene(this, 'You defeated Celery Man!', () => {
              if (this.cfg.backPortal) this.buildBackPortal()
              if (runIndex + 1 < runRooms.length && !runRooms[runIndex + 1].isSecretBonus) this.openLevel2Exit(W)
              else showBossDefeatedOverlay(this)
            }, 'cutscene-celery-man-down')
          } else if (dk && NEW_BOSS_KEYS.includes(dk)) {
            showBossCutscene(this, '01', () => {
              if (this.cfg.backPortal) this.buildBackPortal()
              if (runIndex + 1 < runRooms.length && !runRooms[runIndex + 1].isSecretBonus) this.openLevel2Exit(W)
              else showBossDefeatedOverlay(this)
            }, true)
          } else if (runIndex + 1 < runRooms.length && !runRooms[runIndex + 1].isSecretBonus) {
            SoundManager.startTrack(this.sound, 'music-gameplay')
            if (this.cfg.backPortal) this.time.delayedCall(800, () => this.buildBackPortal())
            this.time.delayedCall(1800, () => { this.openLevel2Exit(W) })
          } else {
            if (this.cfg.backPortal)   this.time.delayedCall(800, () => this.buildBackPortal())
            if (this.cfg.hiddenPortal) this.time.delayedCall(800, () => this.buildHiddenPortal())
            if (this.cfg.isSecretBonus) {
              this.time.delayedCall(1800, () => showCongratulatoryOverlay(this))
            } else {
              this.time.delayedCall(1800, () => showBossDefeatedOverlay(this))
            }
          }
        }

        this.boss = new Boss(this, this.cfg.bossSpawnX, bossY, this.cfg.bossHp, 3000, this.cfg.bossKey, this.cfg.bossFlying !== false, this.cfg.bossStationary ?? false, this.cfg.bossAttackRate ?? 3000, this.cfg.bossScale ?? 3.45)
        if (this.cfg.bossBodyOffsetY !== undefined) {
          const bFrame = this.textures.getFrame(this.cfg.bossKey ?? '', 0)
          const bFs = (bFrame?.realWidth ?? 64) / 64
          ;(this.boss.body as Phaser.Physics.Arcade.Body).setOffset(Math.round(16 * bFs), this.cfg.bossBodyOffsetY)
        }
        this.boss.on('bossDead', () => {
          this.bossDefeated = true
          SoundManager.bossDeath()
          this.cameras.main.shake(300, 0.010)
          this.showPopup(W / 2, 400, 'BOSS DEFEATED!', '#ffe066')
          this.addScore(2000)
          if (this.boss2Defeated || !this.cfg.boss2Key) onAllBossesDead()
        })

        // Spawn second boss for dual-boss rooms
        if (this.cfg.boss2Key && this.cfg.boss2Hp && this.cfg.boss2SpawnX) {
          const b2y = this.cfg.boss2SpawnY ?? bossY
          this.boss2 = new Boss(this, this.cfg.boss2SpawnX, b2y, this.cfg.boss2Hp, 3000, this.cfg.boss2Key, false, this.cfg.boss2Stationary ?? false, this.cfg.bossAttackRate ?? 3000, this.cfg.boss2Scale ?? 3.45)
          this.boss2.on('bossDead', () => {
            this.boss2Defeated = true
            SoundManager.bossDeath()
            this.cameras.main.shake(300, 0.010)
            this.showPopup(W / 2, 500, 'BOSS DEFEATED!', '#ffe066')
            this.addScore(2000)
            if (this.bossDefeated) onAllBossesDead()
          })
        }
      }
    }

    if (this.cfg.bossPortal) {
      const { x, y } = this.cfg.bossPortal
      const cy = y - 106  // door center

      drawCastleDoor(this, x, y, this.cfg.isSunset ? 'cave' : 'boss')

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

    // Hidden portal — re-exposed on re-entry if the boss was already defeated
    if (this.cfg.hiddenPortal) {
      const gateKey = this.cfg.bossDefeatedKey
      if (!!(gateKey && this.registry.get(gateKey))) this.buildHiddenPortal()
    }

    // Star-burst orb — boss room instant-kill collectible (dev/localhost only)
    const _isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (this.cfg.isBossRoom && _isLocalhost) {
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
        // Instantly kill all enemies and bosses — no star-contact required
        this.enemies.forEach(e => e.die())
        this.boss?.bossDie()
        this.boss2?.bossDie()
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
          const p = this.player
          if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, orbX, orbY) < 52) {
            pickupTimer.remove()
            fireStarBurst()
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

    // Exit glow at right edge (or custom world position via exitGlowRightX/Y)
    if (this.cfg.comingSoonGlowRight) {
      const gx  = this.cfg.exitGlowRightX ?? this.cfg.worldWidth
      const gy  = (this.cfg.exitGlowRightY ?? (this.cfg.exitPositions?.right ?? 1952)) - 25
      const color = this.cfg.exitGlowRightColor ?? 0xcc55ff
      const gg = this.add.graphics().setDepth(3)
      for (let i = 9; i >= 0; i--) {
        const t   = i / 9
        const exp = t * 52
        gg.fillStyle(color, (1 - t) * 0.30 + 0.02)
        gg.fillRect(gx - 16 - exp, gy - 65 - exp, 16 + exp * 2, 130 + exp * 2)
      }
      gg.lineStyle(2, color, 0.90)
      gg.strokeRect(gx - 16, gy - 65, 16, 130)
      gg.lineStyle(3, color, 1)
      gg.beginPath(); gg.moveTo(gx - 16, gy - 70); gg.lineTo(gx - 16, gy + 70); gg.strokePath()
      gg.beginPath(); gg.moveTo(gx,      gy - 70); gg.lineTo(gx,      gy + 70); gg.strokePath()
      this.tweens.add({ targets: gg, alpha: { from: 0.65, to: 1 }, duration: 1200, yoyo: true, repeat: -1 })
    }

    if (this.cfg.isOutdoor && this.tilemapLayers.length > 0) {
      paintOutdoorTiles(this, this.tilemapLayers[0], Math.round(map.tileWidth * SCALE), Math.round(map.tileHeight * SCALE), ox, oy, !!this.cfg.isSunset)
    }

    // Mimic enemies — skip in boss rooms, dormant until player proximity
    if (!this.cfg.isBossRoom) {
      const furnXs = (this.cfg.furnitureSpawns ?? []).map(f => f.x)
      for (const ms of (this.cfg.mimicSpawns ?? [])) {
        if (this.enemies.some(e => Math.hypot(ms.x - e.x, ms.y - e.y) < CLUSTER_DIST)) continue
        if (furnXs.some(fx => Math.abs(ms.x - fx) < 100)) continue
        const mimicY = ms.y + 2
        if (this.isInsideWall(ms.x, mimicY) ||
            this.isInsideWall(ms.x - 22, mimicY) ||
            this.isInsideWall(ms.x + 22, mimicY)) continue
        const mimic = new Mimic(this, ms.x, mimicY)
        this.watchEnemy(mimic)
        this.mimics.push(mimic)
        this.physics.add.collider(mimic, this.platforms)
        this.tilemapLayers.forEach(l => this.physics.add.collider(mimic, l))
      }
    }

    this.spawnSpikeBalls()
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
    itemDrop: ItemType | undefined = undefined,
  ) {
    const visuals: Phaser.GameObjects.GameObject[] = []
    const v = <T extends Phaser.GameObjects.GameObject>(obj: T): T => { visuals.push(obj); return obj }
    let fw: number, fh: number

    if (type === 'bookcase') {
      y -= 15
      fw = 40; fh = 80
      const bsFrame = Phaser.Math.RND.pick([0, 8, 14])
      v(this.add.image(x, y, 'bookshelf', bsFrame).setDepth(3).setDisplaySize(80, 130))

    } else if (type === 'table') {
      fw = 96; fh = 36
      const tableFrame = Phaser.Math.RND.pick([0, 1, 14])
      const cx = tableFrame === 0 ? x + 30 : x
      const cy = y - 22
      v(this.add.rectangle(cx, cy + 4,  5, 12, 0xf0e8d8, 0.92).setDepth(2))
      const fl = v(this.add.rectangle(cx, cy - 4, 5, 8, 0xffdd88, 0.88).setDepth(2))
      this.tweens.add({ targets: fl, scaleX: 0.55, scaleY: 0.72, duration: 85 + Phaser.Math.Between(0, 50), yoyo: true, repeat: -1 })
      v(this.add.image(x, y, 'table', tableFrame).setDepth(3).setDisplaySize(160, 88))

    } else { // chest
      y += 5
      fw = 48; fh = 40
      const frame = (itemDrop === 'invulnerability' || itemDrop === 'attack-boost' || itemDrop === 'speed')
                  ? 2
                  : pizzaDrop ? 1
                  : 0
      v(this.add.image(x, y, 'chests', frame).setDepth(3).setDisplaySize(80, 80))
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
      this.registry.set('furnitureDestroyed', (this.registry.get('furnitureDestroyed') ?? 0) + 1)
      if (obj.abilityDrop !== AbilityType.None) this.spawnAbilityDrop(obj.x, obj.y, obj.abilityDrop)
      if (itemDrop) this.spawnDroppedItem(obj.x, obj.y, itemDrop)
      else if (pizzaDrop) this.spawnPizzaDrop(obj.x, obj.y)
      else if (Math.random() < 0.25) this.spawnFurnitureDrop(obj.x, obj.y)
      if (Math.random() < 0.4) this.spawnGoldCoins(obj.x, obj.y, Phaser.Math.Between(1, 3))
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
      const collected: string[] = this.registry.get(this.collectedLettersKey(keyLevel)) ?? []

      if (!targetWord || !canSpellWord(targetWord, collected)) {
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
      const collected: string[] = this.registry.get(this.collectedLettersKey(keyLevel)) ?? []
      const word: string        = this.registry.get(`level${keyLevel}Word`) ?? ''
      txt.setText(word && canSpellWord(word, collected)
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

  /** Opens the magic-jar word puzzle for a level, using the letters collected so far. */
  private showWordMenu(x: number, y: number, keyLevel: number, onCorrect: () => void) {
    const word: string = this.registry.get(`level${keyLevel}Word`) ?? 'BUG'
    const collected: string[] = this.registry.get(this.collectedLettersKey(keyLevel)) ?? []
    this.puzzleMenu.showWord(word, collected, () => {
      onCorrect()
      this.clearLetterBugs()
      this.showPopup(x, y, 'GREAT JOB!', '#ffe066')
    })
  }

  private showArithmeticMenu(x: number, y: number, question: string, correct: number, onCorrect: () => void) {
    this.puzzleMenu.showArithmetic(question, correct, () => {
      onCorrect()
      this.showPopup(x, y, 'CORRECT!', '#ffe066')
    })
  }

  private spawnKeyDrop(x: number, y: number, keyLevel: number) {
    const dropY = y - 16
    const glow = this.add.circle(x, dropY, 22, 0xffffff, 0.55).setDepth(7)
    this.tweens.add({ targets: glow, alpha: 0.2, scaleX: 1.5, scaleY: 1.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const img = this.add.image(x, dropY, 'item-key').setDepth(8).setScale(1.5)
    img.setData('item', { type: 'key', x, y: dropY, keyLevel } as ItemSpawn)
    img.setData('ring', glow)
    this.tweens.add({ targets: img, y: dropY - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const lines = keyLevel === 1 ? ['You did it!', 'Grab the magic key', 'to save Dad!']
                : keyLevel === 2 ? ['You did it!', 'Grab the magic key', 'to save Mom!']
                :                  ['You did it!', 'Grab the magic key!']
    const bubble = this.showNpcBubble(x, dropY - 72, lines, null)
    bubble.setDepth(10)
    img.setData('keyBubble', bubble)
    this.collectibleSprites.push(img)
  }

  private checkCeleryBoost() {
    if (this.celeryNpcX === null) return
    const p = this.player
    if (!p.isAlive || p.x <= this.celeryNpcX + 80) return
    this.celeryNpcX = null
    if (!p.invulnerabilityActive) p.applyInvulnerability(true)
    if (!p.speedBoostActive)      p.applySpeedBoost(true)
    if (!p.strengthBoostActive)   p.applyStrengthBoost(true)
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

  private spawnDroppedItem(x: number, y: number, type: ItemType) {
    if (type === 'pizza') { this.spawnPizzaDrop(x, y); return }
    const tex = type === 'invulnerability' ? 'invulnerability_icon'
              : type === 'mystery'         ? 'item-mystery'
              : type === 'heart'           ? 'item-heart'
              : type === 'life'            ? 'item-life'
              : 'item-orb'
    const dropY = y - 16
    const img = this.add.image(x, dropY, tex).setDepth(8).setScale(1.2)
    img.setData('item', { type, x, y: dropY } as ItemSpawn)
    this.tweens.add({ targets: img, y: dropY - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.collectibleSprites.push(img)
    this.time.delayedCall(15000, () => {
      if (!img.active) return
      this.collectibleSprites = this.collectibleSprites.filter(s => s !== img)
      this.tweens.add({ targets: img, alpha: 0, duration: 800, onComplete: () => img.destroy() })
    })
  }

  private spawnFurnitureDrop(x: number, y: number) {
    this.spawnPizzaDrop(x, y)
  }

  private spawnGoldCoins(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const cx = x + (Math.random() - 0.5) * 48
      let dropY = y - 8
      if (this.tilemapLayers.length > 0) {
        for (let sy = y; sy < y + 240; sy += 4) {
          if (this.isInsideWall(cx, sy)) { dropY = sy - 14; break }
        }
      }
      const coin  = this.add.container(cx, dropY).setDepth(8)
      coin.add(this.add.circle(0, 0, 7, 0xffd700, 1))
      coin.add(this.add.circle(-2, -2, 3, 0xffff99, 0.65))
      coin.setData('item', { type: 'gold-coin', x: cx, y: dropY })
      this.tweens.add({ targets: coin, y: dropY - 18, duration: 550 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.collectibleSprites.push(coin)
      this.time.delayedCall(12000, () => {
        if (!coin.active) return
        this.collectibleSprites = this.collectibleSprites.filter(s => s !== coin)
        this.tweens.add({ targets: coin, alpha: 0, duration: 700, onComplete: () => coin.destroy() })
      })
    }
  }

  // ── players ─────────────────────────────────────────────────────────────────

  private spawnPlayer() {
    const entryDir: ExitDir | null = this.registry.get('entryDir') ?? null
    const pos = this.spawnPoint(entryDir)

    const p = new Player(this, pos.x, pos.y)
    p.setDepth(3)  // above background door (depth 1) so player stands in front
    this.player = p

    if (this.sys.game.device.input.touch) this.touchControls = new TouchControls(this)
    this.inputReader = new InputReader(this, this.touchControls)
    this.shieldGfx = this.add.graphics().setDepth(4)

    this.ability = createAbility(this, p)

    p.on('died', () => this.onPlayerDied(p))
    p.on('useMelee', (src: Player) => this.doMeleeSwing(src))
    p.on('useCharacterAbility', () => this.ability.use())
    p.on('heartLost', () => {
      this.registry.set('hitsTaken', (this.registry.get('hitsTaken') ?? 0) + 1)
    })
  }

  /** Where the player appears when entering this room (or respawning in it). */
  private spawnPoint(entryDir: ExitDir | null): { x: number; y: number } {
    return entryDir ? getEntryPos(entryDir, this.cfg) : (this.cfg.defaultSpawn ?? { x: 800, y: 620 })
  }

  /** Saves score, hearts, boosts and transformations so they carry into the next room. */
  private persistPlayerState() {
    const p = this.player
    this.registry.set('score', this.score)
    this.registry.set('persistedHearts', p.hearts)
    const msLeft = (b: 'speed' | 'strength' | 'invuln') => { const t = p.boostTimeLeft(b); return t === Infinity ? -1 : Math.round(t) }
    const boosts: PersistedBoosts = {
      speedMs:    msLeft('speed'),
      strengthMs: msLeft('strength'),
      invulnMs:   msLeft('invuln'),  // only real boosts — Carter's force field pulses aren't tracked here
      isTruck: p.isTruck, isTrex: p.isTrex, hasShadow: p.isShadowForm, isDinoForm: p.isDinoForm,
      carterAbility: p.carterAbility, conradAbility: p.conradAbility, isConradTransformed: p.isConradTransformed,
    }
    this.registry.set('persistedBoosts', boosts)
  }

  private useBackPortal() {
    const ri: number = this.registry.get('runIndex') ?? 0
    if (ri <= 0 || this.roomTransitioning) return
    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.persistPlayerState()
    this.resetRoomLetterBugs()
    this.registry.set('runIndex', ri - 1)
    this.registry.set('entryDir', this.cfg.backPortalEntryDir ?? 'right')
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private buildBackPortal() {
    if (!this.cfg.backPortal) return
    const { x, y } = this.cfg.backPortal
    const cy = y - 106
    drawCastleDoor(this, x, y, 'plain')

    this.backPortalLbl = this.add.text(x, cy - 158, '↑ RETURN', {
      fontSize: '9px', fontFamily: FONT, color: '#000000',
    }).setOrigin(0.5).setDepth(11).setVisible(false)
    this.backPortalPos = this.cfg.backPortal
  }

  private buildHiddenPortal() {
    if (!this.cfg.hiddenPortal) return
    this.hiddenPortalPos = this.cfg.hiddenPortal
  }

  private enterBossPortal() {
    const ri: number = this.registry.get('runIndex') ?? 0
    if (this.roomTransitioning) return
    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.persistPlayerState()
    this.resetRoomLetterBugs()
    this.registry.set('runIndex', ri + 1)
    this.registry.set('entryDir', 'left')
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private useHiddenPortal() {
    const ri: number = this.registry.get('runIndex') ?? 0
    if (this.roomTransitioning) return
    this.roomTransitioning = true
    this.gm.pause()
    this.physics.world.isPaused = true
    this.persistPlayerState()
    this.resetRoomLetterBugs()
    this.registry.set('runIndex', ri + 1)
    this.registry.set('entryDir', 'left')
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  /** Restores hearts, boosts and transformations saved by persistPlayerState(). */
  private restorePlayerState() {
    const p = this.player
    const persistedHearts: number | null = this.registry.get('persistedHearts')
    if (typeof persistedHearts === 'number') p.hearts = persistedHearts

    // Some rooms end boosts on entry (transformations still carry over)
    if (this.cfg.resetsBoosts) {
      const prev = this.registry.get('persistedBoosts') as PersistedBoosts | null
      if (prev) this.registry.set('persistedBoosts', { ...prev, speedMs: 0, strengthMs: 0, invulnMs: 0, speedBoostActive: false, strengthBoostActive: false, invulnerabilityActive: false })
    }

    const pb = this.registry.get('persistedBoosts') as PersistedBoosts | null
    if (!pb) return
    const duration = (ms: number | undefined, legacyFlag: boolean | undefined): boolean | number | null =>
      ms === -1 || (ms === undefined && legacyFlag) ? true : ms && ms > 0 ? ms : null
    const speed = duration(pb.speedMs, pb.speedBoostActive)
    const strength = duration(pb.strengthMs, pb.strengthBoostActive)
    const invuln = duration(pb.invulnMs, pb.invulnerabilityActive)
    if (speed !== null)    p.applySpeedBoost(speed)
    if (strength !== null) p.applyStrengthBoost(strength)
    if (invuln !== null)   p.applyInvulnerability(invuln)
    if (pb.isTruck && p.charKey === 'eric') {
      p.isTruck = true
      p.setTexture('sheet-eric-transformer', 12)
      p.play('eric-anim-truck-idle', true)
    }
    if (pb.isTrex && p.charKey === 'scarlett') {
      p.isTrex = true
      p.setTexture('sheet-trex', 0)
      p.play('trex-idle', true)
    }
    if (pb.hasShadow && p.charKey === 'coco') {
      p.isShadowForm = true
      p.play('coco-shadow-idle', true)
    }
    if (p.charKey === 'carter') {
      if (pb.carterAbility) p.carterAbility = pb.carterAbility
      if (pb.isDinoForm) {
        p.isDinoForm      = true
        p.speedMultiplier = 2.0
        p.setTexture('sheet-carter-transform', 7)
        p.play('carter-dino-idle', true)
      }
    }
    if (p.charKey === 'conrad') {
      if (pb.conradAbility) p.conradAbility = pb.conradAbility
      if (pb.isConradTransformed) {
        p.isConradTransformed = true
        p.speedMultiplier     = 2.0
        p.setScale(1.8)
        const rb = p.body as Phaser.Physics.Arcade.Body
        rb.setOffset(18, 10)
        rb.setAllowGravity(false)
        p.setTexture('sheet-conrad-transform', 14)
        p.play('conrad-form-idle', true)
      }
    }
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
    const p = this.player
    // Things that can run straight through enemies and bosses
    const isRamming = () => p.isTruck || p.isTrex || p.isSpindashing || !!this.ability.isRamming?.()

    this.physics.add.collider(p, this.platforms)

    // Breakable blocks — the player and non-flying enemies stand on them
    this.destructibles.forEach(d => this.physics.add.collider(p, d))
    this.enemies.forEach(e => { if (!e.flying) this.destructibles.forEach(d => this.physics.add.collider(e, d)) })

    this.crates.forEach(c => this.physics.add.collider(c, this.platforms))
    for (let i = 0; i < this.crates.length; i++)
      for (let j = i + 1; j < this.crates.length; j++)
        this.physics.add.collider(this.crates[i], this.crates[j])

    // Tilemap layer colliders (worldMap mode)
    this.tilemapLayers.forEach(layer => {
      this.physics.add.collider(p, layer)
      this.enemies.forEach(e => { this.physics.add.collider(e, layer) })
      this.crates.forEach(c => this.physics.add.collider(c, layer))
      if (this.boss)  this.physics.add.collider(this.boss,  layer)
      if (this.boss2) this.physics.add.collider(this.boss2, layer)
    })

    // Per-enemy platform colliders — flying enemies are excluded
    this.enemies.forEach(e => {
      if (!e.flying) this.physics.add.collider(e, this.platforms)
    })

    // Player ↔ enemy: ramming kills the enemy, otherwise the player takes damage
    this.physics.add.collider(p, this.enemyGroup, (_p, _e) => {
      const enemy = _e as Enemy
      if (isRamming() || p.getData('abbySpinHold')) {
        enemy.die()
      } else {
        p.hitByEnemy()
      }
    })

    // Mimic contact — dormant mimics block but don't damage; awake mimics behave like enemies
    this.mimics.forEach(m => {
      this.physics.add.collider(p, m, () => {
        if (!m.isAwake || !m.active) return
        if (isRamming() || p.getData('abbySpinHold')) {
          m.die()
        } else {
          p.hitByEnemy()
        }
      })
    })

    // Boss colliders (separate from enemy group)
    const addBossColliders = (b: Boss) => {
      this.physics.add.collider(b, this.platforms)
      this.physics.add.overlap(p, b, () => {
        if (this.cfg.bossNoAttack) return
        if (Math.abs(p.y - b.y) > 350) return
        if (isRamming()) this.damageBoss(b, p)
        else p.hitByEnemy()
      })
    }
    if (this.boss)  addBossColliders(this.boss)
    if (this.boss2) addBossColliders(this.boss2)

    // Spike balls — bounce off world geometry, block the player and deal damage on contact
    this.spikeBalls.forEach(ball => {
      this.physics.add.collider(ball, this.platforms)
      this.tilemapLayers.forEach(l => this.physics.add.collider(ball, l))
      this.physics.add.collider(p, ball, () => { p.hitByEnemy() })
    })

    // Floor spikes — static, damage on contact
    this.spikeFloorTiles.forEach(spike => {
      this.physics.add.overlap(p, spike, () => { p.hitByEnemy() })
    })

    this.physics.add.overlap(this.projectiles, this.platforms, (proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
    })

    // Enemy projectiles hit the player
    this.physics.add.overlap(p, this.enemyProjectiles, (_p, proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
      p.hitByEnemy()
    })
    this.physics.add.overlap(this.enemyProjectiles, this.platforms, (proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
    })

    // Boss projectiles hit the player but pass through walls
    this.physics.add.overlap(p, this.bossProjectiles, (_p, proj) => {
      ;(proj as Phaser.Physics.Arcade.Image).destroy()
      p.hitByEnemy()
    })
  }

  // ── abilities ───────────────────────────────────────────────────────────────

  /** The standard sword swing. Some characters replace it while transformed (CharacterAbility.melee). */
  doMeleeSwing(src: Player) {
    if (this.ability.melee?.()) return
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
        if (!this.isTargetable(e)) return
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
          this.damageBoss(this.boss, src)
          bb.setVelocityX(dir * 300)
          bb.setVelocityY(-180)
        }
      }
      if (this.boss2?.active) {
        const bb = this.boss2.body as Phaser.Physics.Arcade.Body
        const dx = this.boss2.x - src.x
        const dy = Math.abs(bb.center.y - src.y)
        if (dir * dx > 0 && dir * dx <= RANGE && dy <= HEIGHT) {
          this.damageBoss(this.boss2, src)
        }
      }
      this.destructibles.forEach(d => {
        if (!d.active) return
        const dx = d.x - src.x, dy = Math.abs(d.y - src.y)
        if (dir * dx > 0 && dir * dx <= RANGE && dy <= HEIGHT) d.takeDamage(30, DamageType.Physical)
      })
    })
  }

  // ── combat helpers ───────────────────────────────────────────────────────

  /** Awards score and counts the kill once, when an enemy or mimic actually dies. */
  private watchEnemy(e: Enemy | Mimic) {
    e.once('killed', () => {
      this.addScore(SCORE_ENEMY)
      this.registry.set('enemiesKilled', (this.registry.get('enemiesKilled') ?? 0) + 1)
    })
  }

  /** Alive and not already playing its death animation. */
  isTargetable(e: Enemy): boolean {
    return e.active && !e.isDead
  }

  /** One hit on an enemy. With the strength boost, the source player kills it outright. */
  hitEnemy(e: Enemy, src?: Player) {
    if (e.isDead) return
    if (src?.strengthBoostActive) e.die()
    else e.hit()
  }

  /** Celery Man can't be hurt until Mom and Dad are saved. Every other boss always can. */
  bossIsVulnerable(b: Boss): boolean {
    if (b !== this.boss || this.cfg.bossDefeatedKey !== 'celeryManDefeated') return true
    return !!this.registry.get('dadSaved') && !!this.registry.get('momSaved')
  }

  /**
   * One hit on a boss. Pass the player for direct hits (melee, ramming): the main
   * boss dies instantly to a strength-boosted player. Ranged hits pass no player
   * and play the boss-hit sound.
   */
  damageBoss(b: Boss | null, src?: Player) {
    if (!b?.active || !this.bossIsVulnerable(b)) return
    if (src) {
      if (src.strengthBoostActive && b === this.boss) b.bossDie()
      else b.hit()
    } else {
      SoundManager.bossHit()
      b.hit()
    }
  }

  /** Hits whatever nearestTarget() returned: enemy, boss or breakable. */
  hitTarget(t: Enemy | Destructible, src?: Player, enemyHits = 1) {
    if (t === this.boss || t === this.boss2) this.damageBoss(t as Boss)
    else if (t instanceof Destructible) t.takeDamage(30, DamageType.Physical)
    else for (let i = 0; i < enemyHits; i++) this.hitEnemy(t, src)
  }

  /** Closest live enemy or boss (and optionally breakable) within range of (x, y). */
  nearestTarget(x: number, y: number, range: number, includeBreakables = false): Enemy | Destructible | null {
    const candidates: (Enemy | Destructible)[] = [
      ...this.enemies.filter(e => this.isTargetable(e)),
      ...(includeBreakables ? this.destructibles.filter(d => d.active) : []),
      ...[this.boss, this.boss2].filter((b): b is Boss => !!b?.active),
    ]
    let best: Enemy | Destructible | null = null
    let bestDist = range
    for (const t of candidates) {
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y)
      if (d < bestDist) { bestDist = d; best = t }
    }
    return best
  }

  // ── Conrad army truck ability ─────────────────────────────────────────────────





  // ── Conrad transform ability ──────────────────────────────────────────────────









  // ── Coco shadow ability ───────────────────────────────────────────────────────


  // ── Coco Shadow-form transform ────────────────────────────────────────────────



  // ── Spindash helpers ──────────────────────────────────────────────────────────







  // ── Callum number ability ─────────────────────────────────────────────────────



  // ── Abby transform ability ───────────────────────────────────────────────────
  // Abby animates through abby_transform frames 1-9, with frames 8-11 rotating.
  // Holds on frame 10 for 5 seconds at 3× scale, instantly killing any enemy
  // that comes into contact. Then reforms through frames 11-15 at normal size.


  // ── Scarlett T-Rex transformation ────────────────────────────────────────────



  // ── Carter dinosaur transformation ───────────────────────────────────────────








  // ── Map position overlay ──────────────────────────────────────────────────────

  // Minimap layout — set once in buildMapOverlay, read in updateMapOverlay
  private _mmLeft = 0
  private _mmTop  = 0
  private _mmW    = 0
  private _mmH    = 0

  private buildMapOverlay() {
    const worldW = this.cfg.worldWidth
    const worldH = this.cfg.worldHeight ?? 800

    const isDesktop = !this.sys.game.device.input.touch
    const MAX_W = isDesktop ? 300 : 200
    const MAX_H = isDesktop ? 135 : 90
    const scaleX = MAX_W / worldW
    const scaleY = MAX_H / worldH
    const s = Math.min(scaleX, scaleY)
    const mw = Math.round(worldW * s)
    const mh = Math.round(worldH * s)
    const ml = 328                                // left edge — right of HUD (320px) + 8px gap
    const mt = 8                                  // top edge

    this._mmLeft = ml; this._mmTop = mt
    this._mmW = mw;    this._mmH = mh

    // Static layer: background + tile geometry
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(22)
    gfx.fillStyle(0x000011, 0.72)
    gfx.fillRect(ml, mt, mw, mh)

    // Draw solid tiles from every collision layer
    if (this.tilemapLayers.length > 0) {
      gfx.fillStyle(0x8899aa, 0.35)
      for (const layer of this.tilemapLayers) {
        const tileW = layer.tilemap.tileWidth  * layer.scaleX
        const tileH = layer.tilemap.tileHeight * layer.scaleY
        const ox    = layer.x
        const oy    = layer.y
        const rows  = layer.layer.data
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r]
          for (let c = 0; c < row.length; c++) {
            const tile = row[c]
            if (!tile || tile.index === -1) continue
            const wx = ox + c * tileW
            const wy = oy + r * tileH
            const px = Math.round(ml + wx * s)
            const py = Math.round(mt + wy * s)
            const pw = Math.max(1, Math.round(tileW * s))
            const ph = Math.max(1, Math.round(tileH * s))
            gfx.fillRect(px, py, pw, ph)
          }
        }
      }
    } else {
      // Platform-only rooms: draw cfg.platforms as bars
      gfx.fillStyle(0x8899aa, 0.35)
      for (const plat of this.cfg.platforms) {
        const px = Math.round(ml + (plat.x - plat.w / 2) * s)
        const py = Math.round(mt + (plat.y - plat.h / 2) * s)
        const pw = Math.max(1, Math.round(plat.w * s))
        const ph = Math.max(1, Math.round(plat.h * s))
        gfx.fillRect(px, py, pw, ph)
      }
    }

    // Border drawn on top of tiles
    gfx.lineStyle(1, 0xffffff, 0.30)
    gfx.strokeRect(ml, mt, mw, mh)

    // Dynamic layer for player dots (cleared + redrawn each frame)
    this.minimapDots = this.add.graphics().setScrollFactor(0).setDepth(23)
  }

  private updateMapOverlay() {
    if (!this.minimapDots) return
    const ml = this._mmLeft, mt = this._mmTop
    const mw = this._mmW,   mh = this._mmH
    const worldH = this.cfg.worldHeight ?? 800
    const p = this.player

    this.minimapDots.clear()
    if (!p.isAlive) return
    const px = ml + (p.x / this.cfg.worldWidth) * mw
    const py = mt + (p.y / worldH) * mh
    // White halo + colored center
    this.minimapDots.fillStyle(0xffffff, 0.70)
    this.minimapDots.fillCircle(px, py, 4)
    this.minimapDots.fillStyle(0xffe066, 1)
    this.minimapDots.fillCircle(px, py, 2.5)
  }

  // ── Carter force field ────────────────────────────────────────────────────────








  private fireCeleryStalk() {
    if (!this.boss?.active) return
    const bx = this.boss.x
    const by = this.boss.y
    const target = this.player
    if (!target.isAlive) return
    const angle = Phaser.Math.Angle.Between(bx, by, target.x, target.y)
    const speed = 500
    const texKey = this.textures.exists('proj-fire') ? 'proj-fire' : 'fireball'
    const proj = this.physics.add.image(bx, by, texKey)
    proj.setTint(0x22cc55).setScale(0.7, 1.8)
    this.bossProjectiles.add(proj)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      .setGravityY(-800)
    proj.setAngle(Phaser.Math.RadToDeg(angle))
    this.time.delayedCall(2500, () => { if (proj.active) proj.destroy() })
  }

  private fireMushroom() {
    if (!this.boss?.active) return
    const bx = this.boss.x
    const by = this.boss.y
    const target = this.player
    if (!target.isAlive) return
    const angle = Phaser.Math.Angle.Between(bx, by, target.x, target.y)
    const speed = 420
    const texKey = this.textures.exists('proj-fire') ? 'proj-fire' : 'fireball'
    const proj = this.physics.add.image(bx, by, texKey)
    proj.setTint(0xaa5500).setScale(0.55)
    this.bossProjectiles.add(proj)
    ;(proj.body as Phaser.Physics.Arcade.Body)
      .setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      .setGravityY(-800)
    this.time.delayedCall(2500, () => { if (proj.active) proj.destroy() })
  }

  private fireBossSpecial(ability: AbilityType) {
    if (!this.boss?.active) return

    // Celery man / Mushroom Man: rapid single projectile aimed at nearest player
    if (this.cfg.bossKey === 'sheet-celery') {
      this.fireCeleryStalk()
      return
    }
    if (this.cfg.bossKey === 'sheet-mushroom-man') {
      this.fireMushroom()
      return
    }

    const bx = this.boss.x
    const by = this.boss.y
    const target = this.player
    if (!target.isAlive) return

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
          this.bossProjectiles.add(proj)
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
          this.bossProjectiles.add(proj)
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

        // Damage the player if close to the bolt line (point-to-segment distance)
        const p = target
        const t = Math.max(0, Math.min(1, ((p.x - bx) * dx + (p.y - by) * dy) / (boltLen * boltLen)))
        const nearX = bx + t * dx, nearY = by + t * dy
        if (Math.sqrt((p.x - nearX) ** 2 + (p.y - nearY) ** 2) < 60) p.hitByEnemy()
        break
      }
    }
  }

  private spawnEnemyProjectile(enemy: Enemy) {
    const target = this.player
    if (!target.isAlive) return
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
    this.ui?.updateScore(this.score)
  }

  private onPlayerDied(p: Player) {
    let lives: number = this.registry.get('lives') ?? 1
    lives--
    this.registry.set('lives', lives)
    this.ui.updateLives(lives)
    if (lives > 0) this.showPopup(p.x, p.y - 40, lives === 1 ? 'LAST LIFE!' : `${lives} LIVES LEFT`, '#ff6666')

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
      // Back to where the player entered this room — a fixed spot can be inside a wall in tall maps
      const spawn = this.spawnPoint(this.registry.get('entryDir') ?? null)
      p.setPosition(spawn.x, spawn.y)
      const body = p.body as Phaser.Physics.Arcade.Body
      body.setEnable(true)
      body.setVelocity(0, 0)
    })
  }

  private gameOver() {
    const score = this.score
    const isNewBest = recordScore(score)
    clearSavedRun()
    resetRunState(this.registry)
    SoundManager.stopTrack()
    this.cameras.main.fadeOut(800, 80, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', { score, isNewBest })
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
    this.persistPlayerState()

    const advance = goBack
      ? (this.cfg.leftExitBack ?? 1)
      : (!goBack && dir === 'right' && (this.cfg.rightExitAdvance ?? 1) > 1)
        ? this.cfg.rightExitAdvance!
        : 1
    const nextIndex = goBack ? runIndex - advance : runIndex + advance

    // Past the last room = true win → go to victory screen
    if (nextIndex >= runRooms.length) {
      this.cameras.main.fadeOut(800, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('VictoryScene'))
      return
    }

    this.resetRoomLetterBugs()
    this.registry.set('runIndex', nextIndex)
    this.registry.set('entryDir', OPPOSITE[dir])

    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'))
  }

  private openLevel2Exit(_W: number) {
    this.level2ExitPos = { x: 0, y: 0 }  // flag only; trigger uses p.x >= worldWidth - 100
  }

  // ── input ─────────────────────────────────────────────────────────────────

  /** Applies one frame of input to the player: movement, shield, ability and melee. */
  private applyInput(p: Player, input: InputFrame) {
    if (!p.isAlive) return
    if (input.left) p.moveLeft()
    else if (input.right) p.moveRight()
    else p.stopHorizontal()

    if (input.jump) p.jump()
    else p.jumpReleased()

    if (p.isConradTransformed) p.isFlyingDown = input.down

    if (this.ability.replacesShield?.()) {
      if (input.shieldPressed) this.ability.shieldPressed?.()
    } else {
      p.setShielding(input.shield)
    }

    if (input.abilityPressed && !this.ability.ignoresAbilityPress?.(input)) p.useCharacterAbility()
    if (input.meleePressed) p.swingMelee()
  }

  /** Gamepad buttons for menus: Start pauses; the d-pad and A drive whichever menu is open. */
  private setupGamepadEvents() {
    this.input.gamepad?.on(
      Phaser.Input.Gamepad.Events.BUTTON_DOWN,
      (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
        // Start is blocked while the word menu is open (it is modal)
        if (button.index === 9) { if (!this.puzzleMenu.nav) this.togglePause(); return }
        if (this.gm.isPlaying()) return  // gameplay buttons are read each frame by InputReader

        if (this.puzzleMenu.nav) {
          if (button.index === 12) this.puzzleMenu.nav.up()
          if (button.index === 13) this.puzzleMenu.nav.down()
          if (button.index === 14) this.puzzleMenu.nav.left?.()
          if (button.index === 15) this.puzzleMenu.nav.right?.()
          if (button.index === 0)  this.puzzleMenu.nav.confirm()
          return
        }
        // The pause menu itself is driven by pauseNav (MenuNav)
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

    const resume  = this.pauseBtn(width / 2, height * 0.47, '▶  RESUME')
    const shop    = this.pauseBtn(width / 2, height * 0.56, '$  SHOP')
    const sound   = this.pauseBtn(width / 2, height * 0.65, '')
    const toMenu  = this.pauseBtn(width / 2, height * 0.74, '⌂  MAIN MENU')
    const escHint = this.add.text(width / 2, height * 0.84, 'ESC / Start to resume  ·  M to mute', {
      fontSize: '9px', fontFamily: FONT, color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0)

    const resumeAction = () => this.togglePause()
    const menuAction   = () => {
      this.gm.resume()
      this.physics.world.isPaused = false
      resetRunState(this.registry)
      SoundManager.stopTrack()
      this.scene.start('MenuScene')
    }
    const refreshSound = () => sound.setText(SoundManager.isMuted() ? '♪  SOUND: OFF' : '♪  SOUND: ON')
    const soundAction  = () => { setSoundMuted(!SoundManager.isMuted()); refreshSound() }
    refreshSound()
    onKeyPress(this, e => { if (e.code === 'KeyM') refreshSound() })  // M toggles sound globally (main.ts)

    const shopAction = () => {
      this.pauseNav.enabled = false
      this.pauseNav.hideCursor()
      this.pauseContainer.setVisible(false)
      this.shopMenu.open(this.shopItems(), () => {
        this.pauseContainer.setVisible(true)
        this.pauseNav.enabled = true
      })
    }

    resume.on('pointerdown', resumeAction)
    shop.on('pointerdown',   shopAction)
    sound.on('pointerdown',  soundAction)
    toMenu.on('pointerdown', menuAction)

    this.pauseContainer = this.add.container(0, 0, [overlay, title, resume, shop, sound, toMenu, escHint])
      .setDepth(100).setVisible(false)

    // Keyboard / gamepad navigation, active only while paused. Start toggles pause, so only A activates.
    this.pauseNav = new MenuNav(this, { colors: null, cursorSize: 16, depth: 200, activateButtons: [0] })
    this.pauseNav.setItems([
      { text: resume, action: resumeAction },
      { text: shop,   action: shopAction   },
      { text: sound,  action: soundAction  },
      { text: toMenu, action: menuAction   },
    ])
    this.pauseNav.enabled = false

    this.shopMenu = new ShopMenu(this, {
      get:   () => this.registry.get('goldCoins') ?? 0,
      spend: (n) => {
        const left = (this.registry.get('goldCoins') ?? 0) - n
        this.registry.set('goldCoins', left)
        this.ui.updateCoinCount(left)
      },
    })
  }

  /** What the coin shop sells. Boosts last 30 s of play time (they pause while the game is paused). */
  private shopItems(): ShopItem[] {
    const p = this.player
    const secs = Player.BOOST_MS / 1000
    return [
      { name: 'PIZZA', desc: 'Restores one heart', price: 100,
        unavailable: () => p.hearts >= 5 ? 'HEARTS ALREADY FULL' : null,
        buy: () => { p.hearts = Math.min(5, p.hearts + 1) } },
      { name: 'SPEED BOOST', desc: `Run 3x faster for ${secs} s`, price: 150,
        buy: () => p.applySpeedBoost(Player.BOOST_MS) },
      { name: 'POWER BOOST', desc: `Defeat enemies in one hit for ${secs} s`, price: 300,
        buy: () => p.applyStrengthBoost(Player.BOOST_MS) },
      { name: 'INVINCIBILITY', desc: `Take no damage for ${secs} s`, price: 300,
        buy: () => p.applyInvulnerability(Player.BOOST_MS) },
      { name: 'EXTRA LIFE', desc: 'One more try', price: 500,
        buy: () => {
          const lives = (this.registry.get('lives') ?? STARTING_LIVES) + 1
          this.registry.set('lives', lives)
          this.ui.updateLives(lives)
        } },
    ]
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
    if (this.puzzleMenu.nav) return  // word menu is modal — ESC/Start cannot interrupt it
    if (this.shopMenu.isOpen) { this.shopMenu.close(); return }  // ESC/Start backs out of the shop first
    const nowPaused = this.gm.isPlaying()
    if (nowPaused) { this.gm.pause(); SoundManager.pauseTrack() }
    else           { this.gm.resume(); SoundManager.resumeTrack() }
    this.pauseContainer.setVisible(nowPaused)
    this.physics.world.isPaused = nowPaused
    this.pauseNav.enabled = nowPaused
    if (!nowPaused) this.pauseNav.hideCursor()
  }

  // ── update ────────────────────────────────────────────────────────────────

  /** Redraws the shield bubble and Carter's force-field ring around the player. */
  private drawPlayerEffects(p: Player) {
    const g = this.shieldGfx
    g.clear()

    if (p.isAlive && p.shielding) {
      const t   = this.time.now
      const R   = 58   // shield radius

      // Soft inner fill — pulses gently
      const fill = 0.22 + 0.10 * Math.sin(t / 130)
      g.fillStyle(0x55bbff, fill)
      g.fillCircle(p.x, p.y, R)

      // Bright outer ring
      g.lineStyle(3, 0xaaeeff, 0.85 + 0.15 * Math.sin(t / 90))
      g.strokeCircle(p.x, p.y, R)

      // Second inner ring
      g.lineStyle(1, 0xffffff, 0.30 + 0.20 * Math.sin(t / 70 + 1))
      g.strokeCircle(p.x, p.y, R - 8)

      // Orbiting star-points (6 points spaced evenly, each a small 4-pointed star)
      const STAR_COUNT = 6
      for (let s = 0; s < STAR_COUNT; s++) {
        const angle  = (t / 600) + (s / STAR_COUNT) * Math.PI * 2
        const twinkle = 0.5 + 0.5 * Math.sin(t / 180 + s * 1.3)
        const sx = p.x + Math.cos(angle) * R
        const sy = p.y + Math.sin(angle) * R
        const sr = 3 + 2 * twinkle   // star radius pulses

        g.fillStyle(0xffffff, 0.7 + 0.3 * twinkle)
        // Four-pointed cross star
        g.fillRect(sx - sr / 2, sy - 1, sr, 2)
        g.fillRect(sx - 1, sy - sr / 2, 2, sr)
      }

      // Small inner sparkles at fixed angles, randomly twinkling
      const SPARK_COUNT = 8
      for (let s = 0; s < SPARK_COUNT; s++) {
        const angle  = (t / 900 + s * 0.5) + s * (Math.PI * 2 / SPARK_COUNT)
        const dist   = (R - 16) + 6 * Math.sin(t / 200 + s * 0.7)
        const alpha  = 0.2 + 0.6 * Math.abs(Math.sin(t / 250 + s * 1.1))
        g.fillStyle(0xddeeff, alpha)
        g.fillRect(
          p.x + Math.cos(angle) * dist - 1,
          p.y + Math.sin(angle) * dist - 1,
          2, 2,
        )
      }
    }

    // Carter force field — expanding electric ring
    if (p.isAlive && p.getData('carterFF')) {
      const t        = this.time.now
      const elapsed  = t - (p.getData('carterFFStart') as number ?? t)
      const progress = Math.min(1, elapsed / 2000)
      const pulse    = Math.sin(progress * Math.PI)           // 0 → 1 → 0
      const R        = 42 + 33 * pulse

      g.fillStyle(0xccffee, 0.03 * pulse)
      g.fillCircle(p.x, p.y, R)

      g.lineStyle(2, 0xbbffee, 0.20 * pulse)
      g.strokeCircle(p.x, p.y, R)

      g.lineStyle(1, 0xeeffff, 0.12 * pulse)
      g.strokeCircle(p.x, p.y, R - 9)

      // Electric arcs — two-segment lightning bolts radiating outward
      const ARC_COUNT = 6
      for (let a = 0; a < ARC_COUNT; a++) {
        const base = (a / ARC_COUNT) * Math.PI * 2 + t / 480
        const zag  = base + (Math.random() - 0.5) * 0.75
        const midR = R * 0.55
        const mx   = p.x + Math.cos(zag)  * midR
        const my   = p.y + Math.sin(zag)  * midR
        const ex   = p.x + Math.cos(base) * R
        const ey   = p.y + Math.sin(base) * R
        g.lineStyle(1, 0xeeffff, pulse * (0.10 + 0.10 * Math.random()))
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.lineTo(mx, my)
        g.lineTo(ex, ey)
        g.strokePath()
      }
    }
  }

  /** Room exits, doors and portals the player can walk into or interact with. */
  private checkExitsAndPortals(p: Player, input: InputFrame) {
    // Exit boundary detection (all modes except continuous worldMap)
    const isContinuousWorld = !!this.cfg.worldMap && !this.cfg.worldMap.section && !this.cfg.isBossRoom && this.cfg.exits.length === 0
    if (!this.roomTransitioning && p.isAlive && !isContinuousWorld) {
      const W = this.cfg.worldWidth
      const exits = this.cfg.exits
      const ep2 = this.cfg.exitPositions ?? {}
      if (p.x < 0   && exits.includes('left')   && Math.abs(p.y - (ep2.left   ?? 640))   < DOOR_H / 2) { this.exitRoom('left');   return }
      const rightTrigX = this.cfg.rightExitX ?? W
      const rightNeeds = this.cfg.rightExitRequires
      const rightPuzzleBlocked = !!rightNeeds && !this.registry.get(rightNeeds.flag)
      const rightYOk = this.cfg.rightExitYRange
        ? (p.y >= this.cfg.rightExitYRange.min && p.y <= this.cfg.rightExitYRange.max)
        : (this.cfg.rightExitX !== undefined || Math.abs(p.y - (ep2.right ?? 640)) < DOOR_H / 2)
      if (p.x > rightTrigX && exits.includes('right') && rightYOk) {
        if (rightPuzzleBlocked) {
          if (this.time.now - this._rightExitPopupLastTime > 2000) {
            this._rightExitPopupLastTime = this.time.now
            this.showPopup(p.x, p.y - 40, rightNeeds!.hint, '#ff8888')
          }
          return
        }
        this.exitRoom('right'); return
      }
      if (p.y < 0   && exits.includes('top')    && Math.abs(p.x - (ep2.top    ?? W / 2)) < DOOR_W / 2) { this.exitRoom('top');    return }
      if (p.y > 740 && exits.includes('bottom') && Math.abs(p.x - (ep2.bottom ?? W / 2)) < DOOR_W / 2) { this.exitRoom('bottom'); return }
    }

    if (this.bossPortalPos && p.isAlive && !this.roomTransitioning) {
      const nearPortal = Phaser.Math.Distance.Between(p.x, p.y, this.bossPortalPos.x, this.bossPortalPos.y) < 90
      this.portalLabel?.setVisible(nearPortal)
      const needs = this.cfg.portalRequires
      const portalBlocked = !!needs && !this.registry.get(needs.flag)
      if (nearPortal && portalBlocked) {
        if (input.interactPressed) this.showPopup(p.x, p.y - 40, needs!.hint, '#ff8888')
      } else if (nearPortal && input.interactPressed) {
        this.enterBossPortal()
      }
    }

    // Back portal — non-glowing boss door for returning to previous room (CONTINUE mode)
    if (this.backPortalPos && p.isAlive && !this.roomTransitioning) {
      const nearBack = Phaser.Math.Distance.Between(p.x, p.y, this.backPortalPos.x, this.backPortalPos.y) < 90
      this.backPortalLbl?.setVisible(nearBack)
      if (nearBack && input.interactPressed) {
        this.useBackPortal()
      }
    }

    // Hidden portal — secret door to bonus room, appears after boss defeated
    if (this.hiddenPortalPos && p.isAlive && !this.roomTransitioning) {
      const nearHidden = Phaser.Math.Distance.Between(p.x, p.y, this.hiddenPortalPos.x, this.hiddenPortalPos.y) < 90
      if (nearHidden && input.interactPressed) {
        this.useHiddenPortal()
      }
    }

    // Barrier exit — auto-transition when player walks into a wall that seals an exit.
    // Uses one-sided x check: trigger fires once the player reaches or passes be.x
    // (the wall stops them there), gated by a vertical band around be.y.
    if (this.cfg.barrierExit && p.isAlive && !this.roomTransitioning) {
      const be = this.cfg.barrierExit
      if (p.x >= be.x && Math.abs(p.y - be.y) < 300) {
        this.useBackPortal()
      }
    }

    // Level 2 exit — walk into the right world boundary after defeating the dragon
    if (this.level2ExitPos && p.isAlive && !this.roomTransitioning) {
      if (p.x >= this.cfg.worldWidth - 100) {
        this.exitRoom('right')
        return
      }
    }

    // Back exit — walk into the left world boundary
    if (this.backExitPos && p.isAlive && !this.roomTransitioning) {
      if (p.x <= 100) {
        this.exitRoom('left')
        return
      }
    }
  }

  update(_t: number, _dt: number) {
    if (!this.gm.isPlaying()) return
    const input = this.inputReader.read()
    const p = this.player

    if (p.isAlive) this.cameraTarget.setPosition(p.x, p.y)

    p.update()
    this.drawPlayerEffects(p)
    this.applyInput(p, input)

    if (p.shielding) {
      // Absorb enemy projectiles while shielding
      ;(this.enemyProjectiles.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(proj => {
        if (!proj.active) return
        if (Phaser.Math.Distance.Between(p.x, p.y, proj.x, proj.y) < 50) proj.destroy()
      })
    }

    this.checkExitsAndPortals(p, input)

    // Collectibles
    this.collectibleSprites = this.collectibleSprites.filter(img => {
      if (!img.active) return false
      if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, img.x, img.y) < 32) {
        this.collectItem(p, img.getData('item') as ItemSpawn)
        ;(img.getData('ring') as Phaser.GameObjects.Arc | undefined)?.destroy()
        ;(img.getData('keyBubble') as Phaser.GameObjects.Container | undefined)?.destroy()
        img.destroy()
        return false
      }
      return true
    })

    // Enemies
    this.enemies = this.enemies.filter(e => e.active)
    this.enemies.forEach(e => {
      e.update()
      if (e.tryAttack(_dt)) this.spawnEnemyProjectile(e)
    })

    // Mimics — wake on proximity, then patrol via enemies array
    this.mimics = this.mimics.filter(m => m.active)
    for (const m of this.mimics) {
      if (!m.isAwake && p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y) < 200) {
        m.wake()
        this.enemies.push(m as unknown as Enemy)
        this.enemyGroup.add(m)
      }
    }

    // Boss(es)
    if (this.boss?.active)  this.boss.update()
    if (this.boss2?.active) this.boss2.update()

    this.ability.update?.(input)
    this.updateMapOverlay()
    this.updateWordDuck(input)
    this.updateArithDucks(input)
    this.checkCeleryBoost()
    this.updateParentHints()
    this.ui.update(p)

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
