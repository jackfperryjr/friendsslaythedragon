import { AbilityType, DamageType } from '../types'

export type ExitDir = 'left' | 'right' | 'top' | 'bottom'

export interface Platform    { x: number; y: number; w: number; h: number }
export interface SlopeConfig { x1: number; y1: number; x2: number; y2: number }
export interface EnemySpawn  { x: number; y: number; ability: AbilityType }
export interface DestructibleSpawn {
  x: number; y: number; w: number; h: number; health: number
  resistances?: Partial<Record<DamageType, number>>; ability: AbilityType
  furnitureType?: 'bookcase' | 'table' | 'chest'
}
export interface CrateSpawn  { x: number; y: number }

export type ItemType = 'heart' | 'life' | 'mystery' | 'speed' | 'attack-boost' | 'pizza' | 'letter-bug' | 'invulnerability' | 'key-jar' | 'key'
export interface ItemSpawn {
  x: number; y: number
  type: ItemType
  ability?: AbilityType
  keyLevel?: number   // for key-jar / key: which level's key (1 or 2)
  letter?: string     // for letter-bug: assigned at runtime from registry
}

export interface FurnitureSpawn {
  type: 'bookcase' | 'table' | 'chest'
  x: number
  y?: number          // explicit world Y for the furniture center; overrides floor scan
  ability?: AbilityType
  scanFromY?: number  // world Y to start scanning downward; only used when y is absent
  pizzaDrop?: boolean // chest drops a pizza when destroyed
  itemDrop?: ItemType // chest drops a specific item when destroyed
}

export interface SpikeFloorSpawn {
  x: number; y: number
  xEnd?: number       // fill spikes from x to xEnd
  variant?: 1 | 2    // spike_floor1 or spike_floor2 (defaults to 1)
  scale?: number      // display scale multiplier (step = scale * 32, defaults to 1)
}

export interface SpikeBallSpawn {
  x: number; y: number
  count?: number      // number of balls to spawn at this position (default 1)
}

export interface RoomConfig {
  name: string
  worldWidth: number
  tileset: string
  bgFar: string
  bgMid: string
  exits: ExitDir[]
  exitPositions?: Partial<Record<ExitDir, number>>
  barrierExit?: { x: number; y: number }
  barrierVisual?: { x: number; y: number; w: number; h: number }
  isTutorial?: boolean
  isThrone?: boolean
  isBossRoom?: boolean
  bossHp?: number
  bossName?: string
  bossKey?: string
  bossFlying?: boolean
  bossStationary?: boolean    // boss stays in place, no patrol movement
  bossAttackRate?: number     // ms between boss attacks (default 3000)
  bossScale?: number          // display scale multiplier for the boss sprite (default 3.45)
  bossNoAttack?: boolean      // boss never fires projectiles
  bossSpawnX?: number
  bossSpawnY?: number
  bossPortal?: { x: number; y: number }
  bossDefeatedKey?: string   // registry key set to true when this boss room's boss dies
  leftExitForward?: boolean   // left exit advances runIndex instead of going back
  rightExitBack?: boolean     // right exit goes back (decrements runIndex) instead of forward
  backPortal?: { x: number; y: number }  // non-glowing boss door for returning to previous room
  backPortalKey?: string                  // registry key to check instead of bossDefeatedKey
  backPortalEntryDir?: ExitDir            // which direction to enter the previous room from
  hiddenPortal?: { x: number; y: number } // secret door — visible only after boss defeated, advances run
  isSecretBonus?: boolean                 // room only reachable via hiddenPortal; skipped in normal boss-defeat advance
  bossLeftBarrierX?: number               // override x for the left-entry barrier (default: 150)
  bossRightBarrierX?: number              // override x for the right-exit barrier (default: worldWidth - 150)
  bossRightBarrierY?: number              // override center-y for the right-exit barrier
  entrySpawns?: Partial<Record<ExitDir, { x: number; y: number }>>  // per-direction spawn overrides
  spawnX?: number            // override default left-entry X for continuous world rooms
  defaultSpawn?: { x: number; y: number }  // spawn position when entryDir is null
  starOrbSide?: 'left' | 'right'  // which corner the star-burst orb appears in
  starOrb?: { x: number; y: number }  // explicit star-burst orb position (overrides starOrbSide)
  roomImage?: string
  worldHeight?: number
  worldMap?: { key: string; tileKey: string; tilesetName: string; section?: { col: number; row: number; cols: number; rows: number }; renderOffset?: { x: number; y: number } }
  rightExitX?: number             // trigger right exit at this X instead of worldWidth (no Y check)
  musicKey?: string               // overrides 'music-gameplay' for this room (non-boss state)
  bossMusicKey?: string          // overrides 'music-boss' while boss is alive
  comingSoonGlowRight?: boolean  // purple glow at right exit
  exitGlowLeft?: boolean         // purple glow at left entrance
  isOutdoor?: boolean            // use outdoor sky/cloud backgrounds and scenery
  isSunset?: boolean             // warm sunset sky instead of the default nighttime outdoor sky
  isDark?: boolean               // apply a dark purple overlay (levels 5-7+)
  isRed?: boolean                // apply a red overlay
  isOrange?: boolean             // apply an orange overlay
  worldMapLayers?: {
    background?: string   // decorative bg layer (depth -2, no collision)
    solid?: string[]      // collision layers (depth 1)
    overlay?: string[]    // decorative top layers (depth 3+)
  }
  platforms: Platform[]
  slopes?: SlopeConfig[]
  enemies: EnemySpawn[]
  destructibles: DestructibleSpawn[]
  furnitureSpawns?: FurnitureSpawn[]
  spikeFloors?: SpikeFloorSpawn[]
  spikeBalls?: SpikeBallSpawn[]
  crates: CrateSpawn[]
  items: ItemSpawn[]
  letterBugPool?: Array<{x: number, y: number}>
  mimicSpawns?:   Array<{x: number, y: number}>
}

const HALL    = { tileset: 'tile-castle', bgFar: 'bg-great-hall', bgMid: 'bg-hall-glow'    }
const SANCTUM = { tileset: 'tile-castle', bgFar: 'bg-sanctum',     bgMid: 'bg-sanctum-glow' }
const MAP       = { key: 'world-map',      tileKey: 'tileset',           tilesetName: 'spritefusion' } as const
const BOSS_MAP  = { key: 'boss-map-one',   tileKey: 'boss-tileset-one',  tilesetName: 'spritefusion' } as const
const MAP_TWO   = { key: 'world-map-two',  tileKey: 'tileset-two',       tilesetName: 'spritefusion' } as const
const BOSS_MAP_TWO   = { key: 'boss-map-two',   tileKey: 'boss-tileset-two',   tilesetName: 'spritefusion' } as const
const MAP_THREE      = { key: 'world-map-three', tileKey: 'tileset-three',      tilesetName: 'spritefusion' } as const
const MAP_FOUR       = { key: 'world-map-four',  tileKey: 'tileset-four',        tilesetName: 'spritefusion' } as const
const MAP_FIVE       = { key: 'world-map-five',  tileKey: 'tileset-five',        tilesetName: 'spritefusion' } as const
const MAP_SIX        = { key: 'world-map-six',   tileKey: 'tileset-six',         tilesetName: 'spritefusion' } as const
const MAP_SEVEN      = { key: 'world-map-seven', tileKey: 'tileset-seven',       tilesetName: 'spritefusion' } as const
const MAP_LEVEL_ONE  = { key: 'world-map-level-one', tileKey: 'tileset-level-one', tilesetName: 'spritefusion' } as const
const MAP_LEVEL_TWO   = { key: 'world-map-level-two',   tileKey: 'tileset-level-two',   tilesetName: 'spritefusion' } as const
const MAP_LEVEL_THREE = { key: 'world-map-level-three', tileKey: 'tileset-level-three', tilesetName: 'spritefusion' } as const
const BOSS_MAP_FINAL = { key: 'boss-map-final',  tileKey: 'boss-tileset-final',  tilesetName: 'spritefusion' } as const
const BOSS_MAP_THREE      = { key: 'boss-map-three',       tileKey: 'boss-tileset-three',       tilesetName: 'spritefusion' } as const
const BOSS_MAP_FINAL_FINAL = { key: 'boss-map-final-final', tileKey: 'boss-tileset-final-final', tilesetName: 'spritefusion' } as const

// ─── Main World (full tilemap, camera follows player) ─────────────────────────
// Map: maps/intro_one/map.json — 174×117 tiles at 32px = 5568×3744 world pixels

const WORLD_ROOM: RoomConfig = {
  name: 'The Castle',
  ...HALL,
  worldWidth:  174 * 32,   // 5568
  worldHeight: 117 * 32,   // 3744
  worldMap: { ...MAP },
  exits: [],
  platforms: [],
  bossPortal: { x: 4746, y: 3104 },
  enemies: [
    // Skeletons
    { x:  367, y: 1280, ability: AbilityType.Lightning },
    { x:  906, y: 1280, ability: AbilityType.Lightning },
    // Bats
    { x: 1863, y:  768, ability: AbilityType.Bat },
    { x: 1716, y:  150, ability: AbilityType.Bat },
    // Zombies
    { x: 2100, y: 1582, ability: AbilityType.Fire },
    { x:  359, y: 1696, ability: AbilityType.Fire },
    { x:  423, y: 1696, ability: AbilityType.Fire },
    // 5 skeletons
    { x: 1036, y: 2368, ability: AbilityType.Lightning },
    { x: 1100, y: 2368, ability: AbilityType.Lightning },
    { x: 1164, y: 2368, ability: AbilityType.Lightning },
    { x: 1228, y: 2368, ability: AbilityType.Lightning },
    { x: 1292, y: 2368, ability: AbilityType.Lightning },
    // 3 skeletons
    { x: 2968, y:  640, ability: AbilityType.Lightning },
    { x: 3032, y:  640, ability: AbilityType.Lightning },
    { x: 3096, y:  640, ability: AbilityType.Lightning },
    // 2 bats
    { x: 4581, y:  224, ability: AbilityType.Bat },
    { x: 4645, y:  224, ability: AbilityType.Bat },
    // 2 zombies
    { x: 4582, y:  672, ability: AbilityType.Fire },
    { x: 4646, y:  672, ability: AbilityType.Fire },
    // 2 bats
    { x: 4544, y:  896, ability: AbilityType.Bat },
    { x: 4608, y:  896, ability: AbilityType.Bat },
    // 2 skeletons
    { x: 2742, y: 1664, ability: AbilityType.Lightning },
    { x: 2806, y: 1664, ability: AbilityType.Lightning },
    // 2 zombies
    { x: 3685, y: 1152, ability: AbilityType.Fire },
    { x: 3749, y: 1152, ability: AbilityType.Fire },
    // Zombie
    { x: 5105, y: 1760, ability: AbilityType.Fire },
    // 2 zombies
    { x: 5065, y: 2209, ability: AbilityType.Fire },
    { x: 5129, y: 2209, ability: AbilityType.Fire },
    // Skeleton
    { x: 3688, y: 1440, ability: AbilityType.Lightning },
    // Zombie
    { x: 3669, y: 1664, ability: AbilityType.Fire },
    // 2 bats
    { x: 2791, y: 2031, ability: AbilityType.Bat },
    { x: 2855, y: 2031, ability: AbilityType.Bat },
  ],
  destructibles: [],
  furnitureSpawns: [
    // tables and chests shifted +5 y to sit on floor; floating table at x=2742 removed
    { type: 'table',    x:  336, y: 1290 },
    { type: 'bookcase', x:  392, y: 1280 },
    { type: 'bookcase', x: 1566, y: 1696 },
    { type: 'bookcase', x: 1720, y: 2364 },
    { type: 'bookcase', x: 1761, y: 1696 },
    { type: 'table',    x:  534, y: 1706 },
    { type: 'table',    x:  919, y: 2378 },
    { type: 'chest',    x: 2019, y: 2474, ability: AbilityType.Fire },
    { type: 'table',    x: 3064, y:  362 },
    { type: 'bookcase', x: 3120, y:  352 },
    { type: 'chest',    x: 2407, y:  650 },
    { type: 'table',    x: 2884, y:  650 },
    { type: 'bookcase', x: 3408, y:  640 },
    { type: 'bookcase', x: 5238, y:  224 },
    { type: 'table',    x: 3885, y:  682 },
    { type: 'bookcase', x: 3941, y:  672 },
    { type: 'table',    x: 3995, y:  682 },
    { type: 'bookcase', x: 4893, y:  896 },
    { type: 'table',    x: 4949, y:  906 },
    { type: 'table',    x: 2658, y:  906 },
    { type: 'bookcase', x: 2842, y: 1152 },
    { type: 'table',    x: 4552, y: 2539 },
    { type: 'bookcase', x: 4608, y: 2524 },
    { type: 'bookcase', x: 3541, y: 1440 },
    { type: 'bookcase', x: 3834, y: 1440 },
    { type: 'bookcase', x: 3540, y: 1664 },
    { type: 'bookcase', x: 3851, y: 1664 },
    { type: 'table',    x: 3724, y: 2538 },
    { type: 'chest',    x: 3376, y: 2538 },
    { type: 'bookcase', x: 2912, y: 3200 },
    { type: 'chest',    x: 4900, y: 3118, pizzaDrop: true },
  ],
  spikeFloors: [
    { x: 2305, y: 3205, xEnd: 2721, scale: 2 },
    { x: 163,  y: 2625, xEnd: 685,  scale: 2 },
  ],
  crates: [
    { x: 1800, y: 580 }, { x: 2500, y: 580 },
    { x: 3300, y: 580 }, { x: 4100, y: 580 },
  ],
  items: [
    { x: 3741, y: 3196, type: 'key-jar', keyLevel: 1 },
    { x: 1778, y: 2460, type: 'letter-bug', keyLevel: 1 },
    { x:  369, y: 1948, type: 'letter-bug', keyLevel: 1 },
    { x: 3196, y: 1660, type: 'letter-bug', keyLevel: 1 },
    { x: 4620, y:  640, type: 'letter-bug', keyLevel: 1 },
    { x: 1218, y: 2940, type: 'letter-bug', keyLevel: 1 },
  ],
  letterBugPool: [
    { x: 1778, y: 2460 }, { x:  369, y: 1948 }, { x: 3196, y: 1660 },
    { x: 4620, y:  640 }, { x: 1218, y: 2940 }, { x: 2500, y:  640 },
    { x: 3300, y:  640 }, { x: 2807, y: 1664 }, { x: 3685, y: 1152 },
    { x: 5065, y: 2209 },
  ],
  mimicSpawns: [
    { x: 1700, y: 2450 }, { x: 3400, y: 2530 }, { x: 4600, y: 3100 },
  ],
}

// ─── Boss Room (tilemap-based, accessed via portal in main world) ──────────────
// Map: maps/boss/map.json — 50×50 tiles at 32px = 1600×1600 world pixels
// Floor surface at y=1312 (row 41), mid-platform at y=832

const BOSS_TILEMAP_ROOM: RoomConfig = {
  name: 'Skeleton King\'s Lair',
  ...SANCTUM,
  worldWidth:  50 * 32,   // 1600
  worldHeight: 50 * 32,   // 1600
  worldMap: { ...BOSS_MAP },
  exits: ['left', 'right'],
  exitPositions: { left: 1280, right: 1280 },
  isBossRoom: true,
  bossDefeatedKey: 'skeletonKingDefeated',
  backPortal: { x: 562, y: 1280 },
  bossHp: 15,
  bossName: 'SKELETON KING',
  bossKey: 'sheet-king-skeleton',
  bossFlying: false,
  bossSpawnX: 1331,
  bossSpawnY: 1213,
  bossRightBarrierX: 1497,
  bossRightBarrierY: 1276,
  platforms: [
    { x: 800,  y: 1584, w: 1600, h: 32 },  // bottom seal
  ],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [
    { type: 'bookcase', x: 200, scanFromY: 1280 },
    { type: 'table',    x: 350, scanFromY: 1280 },
    { type: 'chest',    x: 500, scanFromY: 1280, ability: AbilityType.Fire },
  ],
  crates: [],
  items: [
    { x: 400,  y: 1260, type: 'pizza' },
    { x: 1300, y: 1260, type: 'pizza' },
  ],
  mimicSpawns: [
    { x: 900, y: 1285 },
  ],
}

// ─── Level 2: Main World ──────────────────────────────────────────────────────
// Map: maps/intro_two/map.json — 174×117 tiles at 32px = 5568×3744 world pixels
// Player enters from the bottom-left (coming through dragon boss room right exit).
// Boss portal is in the top-left area — leads to Zombie King's Lair.

const LEVEL2_WORLD_ROOM: RoomConfig = {
  name: 'The Forsaken Realm',
  ...HALL,
  worldWidth:  174 * 32,   // 5568
  worldHeight: 117 * 32,   // 3744
  worldMap: { ...MAP_TWO },
  exits: [],
  exitPositions: { left: 3584 },
  spawnX: 314,
  bossPortal: { x: 774, y: 736 },
  platforms: [],
  enemies: [
    // Bottom floor
    { x: 1521, y: 3324, ability: AbilityType.Fire },
    { x: 3122, y: 3500, ability: AbilityType.Fire },
    { x: 3178, y: 3500, ability: AbilityType.Fire },
    { x: 3503, y: 3500, ability: AbilityType.Lightning },
    { x: 5116, y: 3500, ability: AbilityType.Fire },
    { x: 5172, y: 3500, ability: AbilityType.Fire },
    { x: 5228, y: 3500, ability: AbilityType.Fire },
    { x: 4003, y: 3004, ability: AbilityType.Fire },
    { x: 4059, y: 3004, ability: AbilityType.Fire },
    // Bats — mid level
    { x: 3203, y: 2832, ability: AbilityType.Bat },
    { x: 3259, y: 2832, ability: AbilityType.Bat },
    { x: 3315, y: 2832, ability: AbilityType.Bat },
    // Upper level
    { x: 3676, y:  508, ability: AbilityType.Fire },
    { x: 3732, y:  508, ability: AbilityType.Fire },
    { x: 3788, y:  508, ability: AbilityType.Fire },
    { x: 4988, y:  860, ability: AbilityType.Bat },
    { x: 5044, y:  860, ability: AbilityType.Bat },
    { x: 5100, y:  860, ability: AbilityType.Bat },
  ],
  destructibles: [],
  furnitureSpawns: [
    // Bottom floor
    { type: 'table',    x:  481, y: 3580 },
    { type: 'bookcase', x:  537, y: 3567 },
    { type: 'bookcase', x: 1229, y: 3324 },
    { type: 'table',    x: 3003, y: 3337 },
    { type: 'table',    x: 3345, y: 3017 },
    { type: 'bookcase', x: 3401, y: 3004 },
    { type: 'table',    x: 5082, y: 3017 },
    { type: 'bookcase', x: 5138, y: 3004 },
    // Mid level
    { type: 'bookcase', x:  895, y: 2012 },
    { type: 'table',    x: 1974, y: 2025 },
    { type: 'table',    x: 4412, y: 2025 },
    // Upper level
    { type: 'table',    x:  499, y: 1801 },
    { type: 'bookcase', x:  555, y: 1788 },
    { type: 'table',    x:  705, y: 1353 },
    { type: 'bookcase', x: 1726, y: 1340 },
    { type: 'bookcase', x: 2963, y:  892 },
    { type: 'chest',    x:  640, y:  750, pizzaDrop: true },
  ],
  spikeFloors: [
    { x: 178, y: 3004, xEnd: 796, scale: 2 },
  ],
  spikeBalls: [
    { x: 5177, y: 2332, count: 2 },
    { x: 2800, y: 2620, count: 1 },
    { x: 1611, y: 3004, count: 2 },
    { x: 2516, y: 1564, count: 3 },
  ],
  crates: [],
  items: [
    { x: 1878, y:  732, type: 'key-jar', keyLevel: 2 },
    { x: 2056, y: 3500, type: 'letter-bug', keyLevel: 2 },
    { x: 5404, y: 2012, type: 'letter-bug', keyLevel: 2 },
    { x: 3666, y: 1116, type: 'letter-bug', keyLevel: 2 },
    { x: 1100, y: 3324, type: 'letter-bug', keyLevel: 2 },
    { x: 4650, y:  860, type: 'letter-bug', keyLevel: 2 },
  ],
  letterBugPool: [
    { x: 2056, y: 3500 }, { x: 5404, y: 2012 }, { x: 3666, y: 1116 },
    { x: 1100, y: 3324 }, { x: 4650, y:  860 }, { x:  488, y: 3369 },
    { x: 3676, y:  508 }, { x: 4988, y:  860 }, { x: 3503, y: 3500 },
    { x: 1521, y: 3324 },
  ],
  mimicSpawns: [
    { x: 1800, y: 3500 }, { x: 4200, y: 3500 },
  ],
}

// ─── Level 2: Boss Room (Zombie King's Lair) ──────────────────────────────────
// Map: maps/boss_intro_two/map.json — 99×203 tiles at 32px = 3168×6496 world pixels

const LEVEL2_BOSS_ROOM: RoomConfig = {
  name: "Zombie King's Lair",
  ...SANCTUM,
  worldWidth:  99 * 32,   // 3168
  worldHeight: 67 * 32,   // 2144 — tile content ends at row 66
  worldMap: { ...BOSS_MAP_TWO },
  exits: ['left', 'right'],
  exitPositions: { left: 1952, right: 1952 },
  isBossRoom: true,
  bossDefeatedKey: 'zombieKingDefeated',
  backPortal: { x: 2700, y: 1956 },
  leftExitForward: true,
  entrySpawns: { left: { x: 2519, y: 1952 }, right: { x: 400, y: 1948 } },
  bossHp: 20,
  bossName: 'ZOMBIE KING',
  bossKey: 'sheet-king-zombie',
  bossFlying: false,
  bossSpawnX: 1187,
  bossSpawnY: 1805,
  starOrb: { x: 226, y: 174 },
  platforms: [],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [],
  crates: [],
  items: [],
  mimicSpawns: [
    { x: 1100, y: 1925 }, { x: 2100, y: 1925 },
  ],
}

// ─── Level 3: Main World ──────────────────────────────────────────────────────
// Map: maps/intro_three/map.json — 174×183 tiles at 32px = 5568×5856 world pixels

const LEVEL3_WORLD_ROOM: RoomConfig = {
  name: 'The Abyss',
  ...HALL,
  worldWidth:  174 * 32,  // 5568
  worldHeight: 183 * 32,  // 5856
  worldMap: { ...MAP_THREE },
  exits: [],
  exitPositions: { left: 2928 },
  entrySpawns: { right: { x: 5300, y: 608 }, left: { x: 597, y: 672 } },
  bossPortal: { x: 517, y: 672 },
  barrierExit: { x: 5500, y: 608 },
  backPortalEntryDir: 'right',
  platforms: [
    { x: 5300, y: 650, w: 400, h: 20 },   // buffer at right-entry spawn to prevent fall
    { x: 5556, y: 2928, w: 24, h: 5856 }, // right-edge wall prevents falling off world boundary
  ],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [
    { type: 'chest', x: 680, y: 686, pizzaDrop: true },
  ],
  spikeFloors: [
    { x: 178, y: 3580, xEnd: 3580, scale: 2 },
  ],
  spikeBalls: [
    // mid-map cluster (redistributed from top-left and top-right)
    { x: 1800, y: 1400, count: 3 },
    { x: 3400, y: 4000, count: 4 },
    { x: 1200, y: 1800, count: 3 },
    { x: 3600, y: 2000, count: 4 },
    // bottom corners
    { x:  400, y: 5500, count: 7 },
    { x: 5200, y: 5500, count: 7 },
    // center
    { x: 2784, y: 2928, count: 5 },
  ],
  crates: [],
  items: [
    // Anchored near known-accessible spots: chest at (680,686), right-entry platform at (5300,608)
    { x:  680, y: 640, type: 'letter-bug', keyLevel: 3 },
    { x: 1600, y: 640, type: 'letter-bug', keyLevel: 3 },
    { x: 2784, y: 640, type: 'letter-bug', keyLevel: 3 },
    { x: 4000, y: 640, type: 'letter-bug', keyLevel: 3 },
    { x: 5200, y: 608, type: 'letter-bug', keyLevel: 3 },
  ],
  letterBugPool: [
    { x:  680, y: 640 }, { x: 1600, y: 640 }, { x: 2784, y: 640 },
    { x: 4000, y: 640 }, { x: 5200, y: 608 }, { x: 5300, y: 608 },
    { x:  800, y: 640 }, { x: 2000, y: 640 }, { x: 3500, y: 640 },
    { x: 4500, y: 640 },
  ],
  mimicSpawns: [
    { x: 1400, y: 686 }, { x: 3200, y: 672 },
  ],
}

// ─── Level 3: Boss Room (Celery Man's Lair) ───────────────────────────────────
// Map: maps/boss_intro_three/map.json — 99×203 tiles at 32px = 3168×6496 world pixels

const BOSS_THREE_ROOM: RoomConfig = {
  name: "Celery Man's Lair",
  ...SANCTUM,
  worldWidth:  99 * 32,   // 3168
  worldHeight: 67 * 32,   // 2144 — tile content ends at row 66
  worldMap: { ...BOSS_MAP_THREE },
  exits: ['left', 'right'],
  exitPositions: { left: 640, right: 1952 },
  isBossRoom: true,
  bossDefeatedKey: 'celeryManDefeated',
  backPortal: { x: 866, y: 1948 },
  backPortalEntryDir: 'left',
  entrySpawns: { left: { x: 429, y: 1952 } },
  bossHp: 25,
  bossName: 'CELERY MAN',
  bossKey: 'sheet-celery',
  bossFlying: false,
  bossStationary: true,
  bossAttackRate: 700,
  bossSpawnX: 2319,
  bossSpawnY: 1800,
  bossScale: 5,
  starOrb: { x: 1219, y: 512 },
  platforms: [
    { x: 16, y: 640, w: 32, h: 130 },   // seal left exit
  ],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [],
  crates: [],
  items: [],
  mimicSpawns: [
    { x: 1000, y: 1925 }, { x: 2200, y: 1925 },
  ],
}

// ─── Level One: The Red Halls ─────────────────────────────────────────────────
// Map: maps/level_one/map.json — 407×156 tiles at 32px = 13024×4992 world pixels

const LEVEL_ONE_ROOM: RoomConfig = {
  name: 'The Red Halls',
  ...HALL,
  worldWidth:  407 * 32,  // 13024
  worldHeight: 156 * 32,  // 4992
  worldMap: MAP_LEVEL_ONE,
  worldMapLayers: {
    background: 'Background walls',
    solid:      ['Walls', 'Platforms large', 'Platform small'],
    overlay:    ['Banner', 'Windows'],
  },
  isRed: true,
  exits: ['left', 'right'],
  defaultSpawn:  { x: 174, y: 348 },
  entrySpawns:   { right: { x: 5200, y: 3036 } },
  bossPortal:    { x: 12541, y: 572 },
  rightExitX:    5313,
  platforms:     [],
  enemies:       [],
  destructibles: [],
  furnitureSpawns: [
    { type: 'chest',    x:  349,  y: 956, itemDrop: 'invulnerability' },
    { type: 'bookcase', x:  900,  scanFromY: 200 },
    { type: 'table',    x: 2100,  scanFromY: 200 },
    { type: 'chest',    x: 3600,  scanFromY: 200 },
    { type: 'bookcase', x: 4900,  scanFromY: 200 },
    { type: 'table',    x: 6300,  scanFromY: 200 },
    { type: 'chest',    x: 7900,  scanFromY: 200, pizzaDrop: true },
    { type: 'bookcase', x: 9100,  scanFromY: 200 },
    { type: 'table',    x: 10600, scanFromY: 200 },
    { type: 'chest',    x: 11900, scanFromY: 200 },
  ],
  crates:        [],
  items: [
    { x:  1200, y:  380, type: 'letter-bug', keyLevel: 4 },
    { x:  2900, y:  560, type: 'letter-bug', keyLevel: 4 },
    { x:  5300, y:  380, type: 'letter-bug', keyLevel: 4 },
    { x:  7700, y:  560, type: 'letter-bug', keyLevel: 4 },
    { x: 10600, y:  380, type: 'letter-bug', keyLevel: 4 },
    { x:  5589, y: 2492, type: 'key-jar',    keyLevel: 4 },
  ],
  letterBugPool: [
    { x:  1200, y:  380 }, { x:  2900, y:  560 }, { x:  5300, y:  380 },
    { x:  7700, y:  560 }, { x: 10600, y:  380 },
    { x:  1800, y:  540 }, { x:  3600, y:  380 }, { x:  6400, y:  540 },
    { x:  9000, y:  380 }, { x: 11800, y:  540 },
  ],
  mimicSpawns: [
    { x: 2000, y: 340 }, { x: 5800, y: 340 }, { x: 10000, y: 340 },
  ],
}

// ─── Level Two ────────────────────────────────────────────────────────────────
// Map: maps/level_two/map.json — 169×263 tiles at 32px = 5408×8416 world pixels

const LEVEL_TWO_ROOM: RoomConfig = {
  name: 'The Orange Halls',
  ...HALL,
  worldWidth:  169 * 32,  // 5408
  worldHeight: 263 * 32,  // 8416
  worldMap: MAP_LEVEL_TWO,
  worldMapLayers: {
    background: 'Background walls',
    solid:      ['Walls', 'Platforms large', 'Platform small'],
    overlay:    ['Banner', 'Windows'],
  },
  isOrange: true,
  exits: ['left', 'right'],
  defaultSpawn:    { x: 128, y: 3004 },
  entrySpawns:     { left: { x: 128, y: 3004 } },
  bossPortal:      { x: 1079, y: 5372 },
  platforms:       [],
  enemies:         [],
  destructibles:   [],
  furnitureSpawns: [],
  crates:          [],
  items: [
    { x:  500, y: 3200, type: 'letter-bug', keyLevel: 8 },
    { x: 1400, y: 4300, type: 'letter-bug', keyLevel: 8 },
    { x: 2800, y: 5100, type: 'letter-bug', keyLevel: 8 },
    { x: 3900, y: 4600, type: 'letter-bug', keyLevel: 8 },
    { x: 4700, y: 3800, type: 'letter-bug', keyLevel: 8 },
    { x: 2304, y: 6460, type: 'key-jar',    keyLevel: 8 },
  ],
  letterBugPool: [
    { x:  500, y: 3200 }, { x:  850, y: 3600 }, { x: 1400, y: 4300 },
    { x: 1900, y: 4800 }, { x: 2800, y: 5100 }, { x: 3200, y: 5500 },
    { x: 3900, y: 4600 }, { x: 4300, y: 4100 }, { x: 4700, y: 3800 },
    { x: 2100, y: 3500 }, { x: 3000, y: 6000 }, { x: 4100, y: 5700 },
  ],
  mimicSpawns: [
    { x:  800, y: 3100 }, { x: 2600, y: 4500 }, { x: 4200, y: 5100 },
  ],
}

// ─── Level Three: The Sunset Fields ──────────────────────────────────────────
// Map: maps/level_three/map.json — 409×69 tiles at 32px = 13088×2208 world pixels

const LEVEL_THREE_ROOM: RoomConfig = {
  name: 'The Sunset Fields',
  tileset: 'tile-castle',
  bgFar:   'bg-stars',
  bgMid:   'bg-stars',
  worldWidth:  409 * 32,  // 13088
  worldHeight:  69 * 32,  // 2208
  worldMap: MAP_LEVEL_THREE,
  worldMapLayers: {
    background: 'Background walls',
    solid:      ['Walls', 'Platforms large', 'Platform small'],
    overlay:    ['Banner', 'Windows'],
  },
  isOutdoor: true,
  isSunset:  true,
  musicKey: 'music-level4',
  defaultSpawn: { x: 192, y: 2012 },
  entrySpawns:  { left: { x: 192, y: 2012 } },
  exits: [],
  bossPortal: { x: 10641, y: 2012 },
  platforms: [
    { x: 13076, y: 1104, w: 24, h: 2208 },  // invisible right barrier
  ],
  enemies:         [],
  destructibles:   [],
  furnitureSpawns: [],
  crates:          [],
  items:           [],
  mimicSpawns: [
    { x: 2000, y: 2012 }, { x: 6000, y: 2012 }, { x: 9200, y: 2012 },
  ],
}

// ─── Level 4: Outside World ───────────────────────────────────────────────────
// Map: maps/final_one/map.json — 284×55 tiles at 32px = 9088×1760 world pixels
// Layers: 'Sky' = decorative background, 'Walls' = player collision surfaces.

const LEVEL4_WORLD_ROOM: RoomConfig = {
  name: 'The Outside',
  tileset: 'tile-castle',    // unused (worldMap renders tiles), satisfies type
  bgFar:   'bg-stars',       // unused (worldMap handles background)
  bgMid:   'bg-stars',       // unused
  worldWidth:  284 * 32,     // 9088
  worldHeight:  55 * 32,     // 1760
  worldMap: { ...MAP_FOUR },
  worldMapLayers: {
    background: 'Sky',
    solid:      ['Walls'],
  },
  isOutdoor: true,
  musicKey: 'music-level4',
  defaultSpawn: { x: 256, y: 1628 },
  entrySpawns: { left: { x: 256, y: 1628 }, right: { x: 9018, y: 860 } },
  exits: ['right'],
  rightExitX: 9018,
  platforms: [],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [],
  crates: [],
  items: [
    { x: 1600, y: 1640, type: 'pizza' },
    { x: 4800, y: 1050, type: 'pizza' },
    { x: 7400, y: 1380, type: 'pizza' },
  ],
  mimicSpawns: [
    { x: 2800, y: 1628 }, { x: 5500, y: 1044 }, { x: 7800, y: 1374 },
  ],
}

// ─── Levels 5-7: Dark castle interior rooms ───────────────────────────────────
// Maps: 100×58 tiles at 32px = 3200×1856 world pixels each

const LEVEL5_WORLD_ROOM: RoomConfig = {
  name: 'The Forgotten Keep',
  ...HALL,
  worldWidth:  100 * 32,  // 3200
  worldHeight:  58 * 32,  // 1856
  worldMap: { ...MAP_FIVE },
  isDark: true,
  musicKey: 'music-level5-7',
  exitGlowLeft: true,
  defaultSpawn: { x: 204, y: 220 },
  exits: ['left', 'right'],
  exitPositions: { left: 220 },
  rightExitX: 3115,
  entrySpawns: { left: { x: 204, y: 220 }, right: { x: 3080, y: 1724 } },
  platforms: [],
  enemies: [
    { x:  320, y:  500, ability: AbilityType.BlackDragon },
    { x:  440, y:  900, ability: AbilityType.BlackDragon },
    { x:  560, y: 1200, ability: AbilityType.BlackDragon },
    { x:  680, y:  650, ability: AbilityType.BlackDragon },
    { x:  800, y: 1000, ability: AbilityType.BlackDragon },
    { x:  960, y:  400, ability: AbilityType.BlackDragon },
    { x: 1080, y:  800, ability: AbilityType.BlackDragon },
    { x: 1200, y: 1300, ability: AbilityType.BlackDragon },
    { x: 1320, y:  600, ability: AbilityType.BlackDragon },
    { x: 1440, y: 1000, ability: AbilityType.BlackDragon },
    { x: 1560, y:  450, ability: AbilityType.BlackDragon },
    { x: 1680, y:  850, ability: AbilityType.BlackDragon },
    { x: 1800, y: 1200, ability: AbilityType.BlackDragon },
    { x: 1920, y:  700, ability: AbilityType.BlackDragon },
    { x: 2040, y:  400, ability: AbilityType.BlackDragon },
  ],
  destructibles: [],
  furnitureSpawns: [
    { type: 'chest', x: 380, scanFromY: 0, pizzaDrop: true },
  ],
  spikeFloors: [
    { x: 178, y: 1729, xEnd: 2780, scale: 2 },
  ],
  spikeBalls: [],
  crates: [],
  items: [
    { x:  500, y: 420,  type: 'letter-bug', keyLevel: 5 },
    { x:  900, y: 800,  type: 'letter-bug', keyLevel: 5 },
    { x: 1400, y: 420,  type: 'letter-bug', keyLevel: 5 },
    { x: 1800, y: 800,  type: 'letter-bug', keyLevel: 5 },
    { x: 2500, y: 420,  type: 'letter-bug', keyLevel: 5 },
  ],
  letterBugPool: [
    { x:  500, y: 420 }, { x:  900, y: 800 }, { x: 1400, y: 420 },
    { x: 1800, y: 800 }, { x: 2500, y: 420 }, { x:  700, y: 600 },
    { x: 1100, y: 420 }, { x: 1600, y: 800 }, { x: 2100, y: 420 },
    { x: 2800, y: 800 },
  ],
  mimicSpawns: [
    { x: 800, y: 420 }, { x: 1800, y: 800 },
  ],
}

const LEVEL6_WORLD_ROOM: RoomConfig = {
  name: 'The Shadow Halls',
  ...HALL,
  worldWidth:  100 * 32,  // 3200
  worldHeight:  58 * 32,  // 1856
  worldMap: { ...MAP_SIX },
  isDark: true,
  musicKey: 'music-level5-7',
  defaultSpawn: { x: 204, y: 1724 },
  exits: ['left', 'right'],
  exitPositions: { left: 1600 },
  rightExitX: 3106,
  entrySpawns: { left: { x: 204, y: 1724 }, right: { x: 3080, y: 1724 } },
  platforms: [],
  enemies: [
    { x:  350, y:  600, ability: AbilityType.BlackDragon },
    { x:  470, y: 1000, ability: AbilityType.BlackDragon },
    { x:  590, y:  450, ability: AbilityType.BlackDragon },
    { x:  710, y: 1200, ability: AbilityType.BlackDragon },
    { x:  830, y:  750, ability: AbilityType.BlackDragon },
    { x:  990, y:  500, ability: AbilityType.BlackDragon },
    { x: 1110, y: 1100, ability: AbilityType.BlackDragon },
    { x: 1230, y:  800, ability: AbilityType.BlackDragon },
    { x: 1350, y:  400, ability: AbilityType.BlackDragon },
    { x: 1470, y: 1300, ability: AbilityType.BlackDragon },
    { x: 1590, y:  650, ability: AbilityType.BlackDragon },
    { x: 1710, y:  950, ability: AbilityType.BlackDragon },
    { x: 1830, y:  500, ability: AbilityType.BlackDragon },
    { x: 1950, y: 1200, ability: AbilityType.BlackDragon },
    { x: 2070, y:  700, ability: AbilityType.BlackDragon },
  ],
  destructibles: [],
  furnitureSpawns: [
    { type: 'chest', x: 380, scanFromY: 1600, pizzaDrop: true },
  ],
  spikeBalls: [],
  crates: [],
  items: [
    { x:  500, y: 1600, type: 'letter-bug', keyLevel: 6 },
    { x:  900, y:  800, type: 'letter-bug', keyLevel: 6 },
    { x: 1400, y: 1600, type: 'letter-bug', keyLevel: 6 },
    { x: 1800, y:  800, type: 'letter-bug', keyLevel: 6 },
    { x: 2500, y: 1600, type: 'letter-bug', keyLevel: 6 },
  ],
  letterBugPool: [
    { x:  500, y: 1600 }, { x:  900, y:  800 }, { x: 1400, y: 1600 },
    { x: 1800, y:  800 }, { x: 2500, y: 1600 }, { x:  700, y:  900 },
    { x: 1100, y: 1600 }, { x: 1600, y:  800 }, { x: 2100, y: 1600 },
    { x: 2800, y:  800 },
  ],
  mimicSpawns: [
    { x: 800, y: 1600 }, { x: 1800, y: 800 },
  ],
}

const LEVEL7_WORLD_ROOM: RoomConfig = {
  name: 'The Dragon\'s Approach',
  ...HALL,
  worldWidth:  100 * 32,  // 3200
  worldHeight:  58 * 32,  // 1856
  worldMap: { ...MAP_SEVEN },
  isDark: true,
  musicKey: 'music-level5-7',
  defaultSpawn: { x: 204, y: 1724 },
  exits: ['left'],
  exitPositions: { left: 1724 },
  entrySpawns: { left: { x: 204, y: 1724 }, right: { x: 1700, y: 590 } },
  bossPortal: { x: 1630, y: 604 },
  platforms: [],
  enemies: [
    { x:  300, y:  700, ability: AbilityType.BlackDragon },
    { x:  420, y: 1100, ability: AbilityType.BlackDragon },
    { x:  540, y:  500, ability: AbilityType.BlackDragon },
    { x:  660, y:  900, ability: AbilityType.BlackDragon },
    { x:  780, y: 1300, ability: AbilityType.BlackDragon },
    { x:  950, y:  600, ability: AbilityType.BlackDragon },
    { x: 1070, y:  400, ability: AbilityType.BlackDragon },
    { x: 1190, y: 1000, ability: AbilityType.BlackDragon },
    { x: 1310, y:  800, ability: AbilityType.BlackDragon },
    { x: 1960, y:  500, ability: AbilityType.BlackDragon },
    { x: 2080, y: 1200, ability: AbilityType.BlackDragon },
    { x: 2200, y:  750, ability: AbilityType.BlackDragon },
    { x: 2320, y:  400, ability: AbilityType.BlackDragon },
    { x: 2440, y: 1100, ability: AbilityType.BlackDragon },
    { x: 2680, y:  950, ability: AbilityType.BlackDragon },
  ],
  destructibles: [],
  furnitureSpawns: [
    { type: 'chest', x: 380, scanFromY: 1600, pizzaDrop: true },
  ],
  spikeBalls: [],
  crates: [],
  items: [
    { x:  400, y: 1500, type: 'letter-bug', keyLevel: 7 },
    { x:  700, y:  800, type: 'letter-bug', keyLevel: 7 },
    { x: 1000, y: 1500, type: 'letter-bug', keyLevel: 7 },
    { x: 1200, y:  800, type: 'letter-bug', keyLevel: 7 },
    { x: 1500, y: 1500, type: 'letter-bug', keyLevel: 7 },
  ],
  letterBugPool: [
    { x:  400, y: 1500 }, { x:  700, y:  800 }, { x: 1000, y: 1500 },
    { x: 1200, y:  800 }, { x: 1500, y: 1500 }, { x:  550, y:  900 },
    { x:  850, y: 1500 }, { x: 1100, y:  900 }, { x: 1350, y: 1500 },
    { x:  600, y: 1400 },
  ],
  mimicSpawns: [
    { x: 800, y: 1500 }, { x: 1800, y: 800 },
  ],
}

// ─── Final Boss Room ──────────────────────────────────────────────────────────
// Map: maps/boss_final/map.json — 40×50 tiles at 32px = 1280×1600 world pixels

const BOSS_FINAL_ROOM: RoomConfig = {
  name: "The Dragon's Lair",
  ...SANCTUM,
  worldWidth:  40 * 32,   // 1280
  worldHeight: 50 * 32,   // 1600
  worldMap: { ...BOSS_MAP_FINAL },
  isDark: true,
  bossMusicKey: 'music-boss2',
  bossLeftBarrierX: 50,
  exits: ['left', 'right'],
  exitPositions: { left: 1200, right: 1200 },
  entrySpawns: { left: { x: 200, y: 1380 } },
  backPortal: { x: 200, y: 1500 },
  hiddenPortal: { x: 218, y: 604 },
  isBossRoom: true,
  bossDefeatedKey: 'dragonDefeated',
  bossHp: 30,
  bossName: 'RED DRAGON',
  bossKey: 'sheet-red-dragon',
  bossFlying: true,
  bossSpawnX: 900,
  bossSpawnY: 700,
  bossScale: 4,
  bossAttackRate: 1500,
  bossRightBarrierX: 1200,
  platforms: [],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [],
  crates: [],
  items: [],
  mimicSpawns: [
    { x: 550, y: 1355 }, { x: 950, y: 1355 },
  ],
}

// ─── Final Final Boss Room ────────────────────────────────────────────────────
// Map: maps/boss_final_final/map.json — 40×50 tiles at 32px = 1280×1600 world pixels
// Secret room accessible only via the hidden portal in the Dragon's Lair.

const BOSS_FINAL_FINAL_ROOM: RoomConfig = {
  name: "The True Lair",
  ...SANCTUM,
  worldWidth:  40 * 32,   // 1280
  worldHeight: 50 * 32,   // 1600
  worldMap: { ...BOSS_MAP_FINAL_FINAL },
  isDark: true,
  bossMusicKey: 'music-boss3',
  bossLeftBarrierX: 50,
  isSecretBonus: true,
  exits: ['left', 'right'],
  exitPositions: { left: 1200, right: 1200 },
  entrySpawns: { left: { x: 200, y: 1400 } },
  isBossRoom: true,
  bossDefeatedKey: 'trueDragonDefeated',
  bossHp: 1,
  bossName: 'SILLY DRAGON',
  bossKey: 'sheet-gold-dragon',
  bossFlying: false,
  bossStationary: true,
  bossNoAttack: true,
  bossSpawnX: 640,
  bossSpawnY: 1200,
  bossScale: 7,
  bossRightBarrierX: 1200,
  platforms: [],
  enemies: [],
  destructibles: [],
  furnitureSpawns: [],
  crates: [],
  items: [],
  mimicSpawns: [
    { x: 450, y: 1375 },
  ],
}

export const RUN_LENGTH = 6
export const TOTAL_LETTER_BUGS = 5

// Phonics word lists — 3-letter L1, 4-letter L2, 5-letter L3
export const WORD_LIST_L1 = ['BUG', 'CAT', 'DOG', 'HAT', 'MAP', 'SUN', 'FLY', 'ANT', 'BEE', 'RUN', 'JAM', 'BAT', 'HOP', 'PIG', 'WEB']
export const WORD_LIST_L2 = ['FROG', 'FISH', 'LEAF', 'TREE', 'DUCK', 'JUMP', 'SLUG', 'WING', 'STAR', 'WORM', 'FLEA', 'TOAD', 'MOTH', 'GNAT', 'WASP']
export const WORD_LIST_L3 = ['SNAKE', 'MOUSE', 'HORSE', 'CRANE', 'TIGER', 'GOOSE', 'WHALE', 'EAGLE', 'SHARK', 'ZEBRA', 'SHEEP', 'OTTER', 'RAVEN', 'SQUID', 'BISON']

export function generateRun(): RoomConfig[] {
  return [
    WORLD_ROOM,            //  0 — Level 1
    BOSS_TILEMAP_ROOM,     //  1 — Boss 1: Skeleton King
    LEVEL2_WORLD_ROOM,     //  2 — Level 2
    LEVEL2_BOSS_ROOM,      //  3 — Boss 2: Zombie King
    LEVEL3_WORLD_ROOM,     //  4 — Level 3
    BOSS_THREE_ROOM,       //  5 — Boss 3: Celery Man
    LEVEL4_WORLD_ROOM,     //  6 — Outside (nighttime)
    LEVEL5_WORLD_ROOM,     //  7 — Level 5
    LEVEL6_WORLD_ROOM,     //  8 — Level 6
    LEVEL7_WORLD_ROOM,     //  9 — Level 7 (boss portal TBD)
    BOSS_FINAL_ROOM,       // 10 — Final Boss: The Dragon
    BOSS_FINAL_FINAL_ROOM, // 11 — Secret: The True Dragon (hidden portal only)
  ]
}

// Legacy aliases
export const BOSS_ROOM: RoomConfig = BOSS_TILEMAP_ROOM
export const TUTORIAL_ROOM: RoomConfig = { ...WORLD_ROOM, isTutorial: true }
export const THRONE_ROOM:  RoomConfig  = { ...WORLD_ROOM, isThrone: true  }
// New levels — not yet in the main run; exported for future connection
export { LEVEL_ONE_ROOM, LEVEL_TWO_ROOM, LEVEL_THREE_ROOM }
export const WORLD_NAMES = ['THE CASTLE', 'THE DARK SANCTUM']
export const ROOMS_PER_RUN = 2
export const LEVEL_POOLS: RoomConfig[][] = [[WORLD_ROOM]]
export type LevelConfig = RoomConfig & { roomNum: number; subtitle: string; levelNum: number; goalX: number }
export function generateRoomSequence(_level: number): number[] { return [0] }
