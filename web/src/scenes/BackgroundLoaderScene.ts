import Phaser from 'phaser'

/**
 * Loads big assets the game doesn't need on the first screen (music tracks and
 * boss cutscene images, ~13 MB) in the background, so the game starts faster.
 * BootScene launches it; it runs alongside the other scenes and draws nothing.
 *
 * Anything that needs one of these assets calls `whenAssetLoaded()`, which runs
 * the callback right away if the asset is ready or as soon as it arrives.
 */

type LazyAsset = { type: 'audio' | 'image'; key: string; url: string }

const CUTSCENE_CHARS = ['abby', 'callum', 'carter', 'coco', 'conrad', 'eric', 'scarlett']

/** In download order: music likely needed soonest first. */
const LAZY_ASSETS: LazyAsset[] = [
  { type: 'audio', key: 'music-gameplay',           url: 'assets/music/gameplay_loop.mp3' },
  { type: 'audio', key: 'music-boss',               url: 'assets/music/boss.mp3' },
  { type: 'audio', key: 'music-boss-victory',       url: 'assets/music/boss_victory.mp3' },
  ...CUTSCENE_CHARS.map((char): LazyAsset => ({
    // scarlett's skeleton king filename has a typo
    type: 'image', key: `cutscene-${char}-skeleton_king`,
    url: `assets/players/${char === 'scarlett' ? `${char}_skeletong_king.jpg` : `${char}_skeleton_king.jpg`}`,
  })),
  { type: 'audio', key: 'music-boss2',              url: 'assets/music/boss2.mp3' },
  ...CUTSCENE_CHARS.map((char): LazyAsset => ({ type: 'image', key: `cutscene-${char}-zombie_king`, url: `assets/players/${char}_zombie_king.jpg` })),
  { type: 'audio', key: 'music-boss3',              url: 'assets/music/boss3.mp3' },
  { type: 'image', key: 'cutscene-celery-man-down', url: 'assets/players/celery_man_down.png' },
  { type: 'audio', key: 'music-level4',             url: 'assets/music/gameplay_loop1_5.mp3' },
  // Generic victory pose shown after the later bosses
  ...CUTSCENE_CHARS.map((char): LazyAsset => ({ type: 'image', key: `cutscene-${char}-01`, url: `assets/players/${char}01.png` })),
  { type: 'audio', key: 'music-level5-7',           url: 'assets/music/gameplay_loop2.mp3' },
  { type: 'audio', key: 'music-final-boss-victory', url: 'assets/music/game_victory.mp3' },
  { type: 'image', key: 'cutscene-victory',         url: 'assets/players/victory.png' },
  { type: 'audio', key: 'music-end-game',           url: 'assets/music/end_game.mp3' },
]

const LAZY_KEYS = new Set(LAZY_ASSETS.map(a => a.key))
const waiting = new Map<string, Array<() => void>>()

function isLoaded(game: Phaser.Game, key: string): boolean {
  return game.cache.audio.exists(key) || game.textures.exists(key)
}

/**
 * Runs `cb` once `key` is loaded — immediately if it already is. Keys that
 * aren't background-loaded and don't exist never call back.
 */
export function whenAssetLoaded(game: Phaser.Game, key: string, cb: () => void) {
  if (isLoaded(game, key)) { cb(); return }
  if (!LAZY_KEYS.has(key)) return
  const list = waiting.get(key) ?? []
  list.push(cb)
  waiting.set(key, list)
}

/**
 * Starts background loading if it isn't running yet. Call once the current
 * scene's own assets are in, so the two downloads don't compete.
 */
let started = false
export function startBackgroundLoading(scene: Phaser.Scene) {
  if (started) return
  started = true
  scene.scene.launch('BackgroundLoaderScene')
}

export class BackgroundLoaderScene extends Phaser.Scene {
  constructor() { super({ key: 'BackgroundLoaderScene' }) }

  create() {
    for (const a of LAZY_ASSETS) {
      if (isLoaded(this.game, a.key)) continue
      if (a.type === 'audio') this.load.audio(a.key, a.url)
      else this.load.image(a.key, a.url)
    }
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      const callbacks = waiting.get(key)
      waiting.delete(key)
      callbacks?.forEach(cb => cb())
    })
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[BackgroundLoader] failed to load ${file.key} (${file.url})`)
      waiting.delete(file.key)
    })
    this.load.start()
  }
}
