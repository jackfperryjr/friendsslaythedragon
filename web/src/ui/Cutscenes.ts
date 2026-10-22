import Phaser from 'phaser'
import { SoundManager } from '../audio/SoundManager'
import { resetRunState } from '../game/runState'
import { MenuNav } from './MenuNav'
import { loadSettings, recordRunTime, formatDuration } from '../game/settings'

// Full-screen story moments shown by GameScene: boss cutscenes and the end-of-boss / end-of-game screens.

const FONT = '"Press Start 2P", monospace'

/** Calls `fn` once on the next key press, tap or gamepad button, then stops listening to all three. */
export function onceAnyInput(scene: Phaser.Scene, fn: () => void) {
  let done = false
  const handler = () => {
    if (done) return
    done = true
    scene.input.keyboard?.off('keydown', handler)
    scene.input.off('pointerdown', handler)
    scene.input.gamepad?.off(Phaser.Input.Gamepad.Events.BUTTON_DOWN, handler)
    fn()
  }
  scene.input.keyboard?.on('keydown', handler)
  scene.input.on('pointerdown', handler)
  scene.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, handler)
}

export function showBossCutscene(scene: Phaser.Scene, suffix: string, onComplete: () => void, compact = false) {
  const { width, height } = scene.scale
  const cx = width / 2, cy = height / 2
  const selectedChars: string[] | undefined = scene.registry.get('selectedChars')
  const chars = (selectedChars ?? ['conrad']).slice(0, 4)

  scene.physics.world.isPaused = true
  SoundManager.startTrack(scene.sound, 'music-boss-victory')

  scene.cameras.main.setBackgroundColor('#000000')
  const bg = scene.add.rectangle(cx, cy, width, height, 0x000000, 1)
    .setScrollFactor(0).setDepth(200).setAlpha(0)
  scene.tweens.add({ targets: bg, alpha: 1, duration: 250 })

  const elements: Phaser.GameObjects.GameObject[] = [bg]

  // Show each player's character cutscene centered, aspect-ratio preserved
  const count = chars.length
  chars.forEach((charKey, idx) => {
    const imgKey = `cutscene-${charKey}-${suffix}`
    if (!scene.textures.exists(imgKey)) return
    const slotW = width / count
    const slotX = slotW * (idx + 0.5)
    const img = scene.add.image(slotX, cy, imgKey)
      .setScrollFactor(0).setDepth(201).setAlpha(0)
    const maxH = compact ? height * 0.55 : height
    const maxW = compact ? slotW * 0.55 : slotW
    const scale = Math.min(maxW / img.width, maxH / img.height)
    img.setScale(scale)
    elements.push(img)
    scene.tweens.add({ targets: img, alpha: 1, duration: 350, delay: 150 })
  })

  // After 3 s, show "press any button" prompt at the top
  scene.time.delayedCall(3000, () => {
    if (!scene.scene.isActive('GameScene')) return
    const prompt = scene.add.text(cx, 40, 'PRESS ANY BUTTON TO CONTINUE', {
      fontSize: '10px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202).setAlpha(0)
    elements.push(prompt)
    scene.tweens.add({ targets: prompt, alpha: 1, duration: 300 })
    scene.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, delay: 300 })

    onceAnyInput(scene, () => {
      scene.physics.world.isPaused = false
      SoundManager.startTrack(scene.sound, 'music-gameplay')
      elements.forEach(e => { if (e.active) e.destroy() })
      onComplete()
    })
  })
}

export function showPlaceholderCutscene(scene: Phaser.Scene, message: string, onComplete: () => void, imageKey?: string) {
  const { width, height } = scene.scale
  const cx = width / 2

  scene.physics.world.isPaused = true
  SoundManager.startTrack(scene.sound, 'music-boss-victory')

  scene.cameras.main.setBackgroundColor('#000000')
  const bg = scene.add.rectangle(cx, height / 2, width, height, 0x000000, 1)
    .setScrollFactor(0).setDepth(200).setAlpha(0)
  scene.tweens.add({ targets: bg, alpha: 1, duration: 250 })

  const elements: Phaser.GameObjects.GameObject[] = [bg]

  if (imageKey && scene.textures.exists(imageKey)) {
    const img = scene.add.image(cx, height / 2, imageKey)
      .setScrollFactor(0).setDepth(201).setAlpha(0)
    const scale = Math.min(width / img.width, height / img.height)
    img.setScale(scale)
    scene.tweens.add({ targets: img, alpha: 1, duration: 300, delay: 100 })
    elements.push(img)
  }

  const title = scene.add.text(cx, 44, message, {
    fontSize: '16px', fontFamily: FONT, color: '#ffe066',
    stroke: '#000000', strokeThickness: 6,
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202).setAlpha(0)
  scene.tweens.add({ targets: title, alpha: 1, duration: 350, delay: 150 })
  elements.push(title)

  scene.time.delayedCall(2000, () => {
    if (!scene.scene.isActive('GameScene')) return
    const prompt = scene.add.text(cx, height - 50, 'PRESS ANY BUTTON TO CONTINUE', {
      fontSize: '10px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(202).setAlpha(0)
    elements.push(prompt)
    scene.tweens.add({ targets: prompt, alpha: 1, duration: 300 })
    scene.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, delay: 300 })

    onceAnyInput(scene, () => {
      scene.physics.world.isPaused = false
      SoundManager.startTrack(scene.sound, 'music-gameplay')
      elements.forEach(e => { if (e.active) e.destroy() })
      onComplete()
    })
  })
}

export function showBossDefeatedOverlay(scene: Phaser.Scene) {
  const { width, height } = scene.scale
  const cx = width / 2, cy = height / 2

  scene.cameras.main.setBackgroundColor('#000000')
  SoundManager.startTrack(scene.sound, 'music-final-boss-victory')

  const bg = scene.add.rectangle(cx, cy, width, height, 0x000000, 1)
    .setScrollFactor(0).setDepth(90).setAlpha(0)
  scene.tweens.add({ targets: bg, alpha: 1, duration: 250 })

  let vImg: Phaser.GameObjects.Image | null = null
  if (scene.textures.exists('cutscene-victory')) {
    vImg = scene.add.image(cx, cy, 'cutscene-victory')
      .setScrollFactor(0).setDepth(91).setAlpha(0)
    const scale = Math.min(width / vImg.width, height / vImg.height)
    vImg.setScale(scale)
    scene.tweens.add({ targets: vImg, alpha: 1, duration: 350, delay: 150 })
  }

  const title = scene.add.text(cx, cy - 110, 'BOSS DEFEATED!', {
    fontSize: '28px', fontFamily: FONT, color: '#ffe066',
    stroke: '#000000', strokeThickness: 8,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(92).setAlpha(0)

  const sub = scene.add.text(cx, cy - 55, 'What will you do?', {
    fontSize: '11px', fontFamily: FONT, color: '#ffffff',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(92).setAlpha(0)

  const makeBtn = (x: number, label: string, cb: () => void) => {
    const btn = scene.add.text(x, cy + 30, label, {
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
    if (closed) return
    cleanup()
    ;[bg, title, sub, btnContinue, btnMenu].forEach(e => e.destroy())
    vImg?.destroy()
  })

  const btnMenu = makeBtn(cx + 130, 'MAIN MENU', () => {
    if (closed) return
    cleanup()
    scene.cameras.main.fadeOut(400, 0, 0, 0)
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      resetRunState(scene.registry)
      scene.scene.start('MenuScene')
    })
  })

  // Keyboard / gamepad navigation, enabled once the buttons have faded in
  const nav = new MenuNav(scene, { depth: 93 })
  nav.setItems([
    { text: btnContinue, action: () => btnContinue.emit('pointerdown') },
    { text: btnMenu,     action: () => btnMenu.emit('pointerdown') },
  ])
  nav.enabled = false
  let focusTimer: Phaser.Time.TimerEvent | null = null
  let closed = false

  const cleanup = () => {
    closed = true
    nav.enabled = false
    nav.hideCursor()
    focusTimer?.remove()
  }

  // Fade in text/buttons after image has a moment to appear
  scene.tweens.add({ targets: [title, sub, btnContinue, btnMenu], alpha: 1, duration: 400, delay: 300 })

  // Show cursor on first button after content is visible
  focusTimer = scene.time.delayedCall(750, () => { nav.enabled = true; nav.move(0) })
}

export function showCongratulatoryOverlay(scene: Phaser.Scene) {
  const { width, height } = scene.scale
  const cx = width / 2, cy = height / 2

  scene.cameras.main.setBackgroundColor('#000000')
  SoundManager.startTrack(scene.sound, 'music-end-game')

  const congBg = scene.add.rectangle(cx, cy, width, height, 0x000000, 1)
    .setScrollFactor(0).setDepth(90).setAlpha(0)
  scene.tweens.add({ targets: congBg, alpha: 1, duration: 300 })

  scene.add.text(cx, cy - 185, 'CONGRATULATIONS!', {
    fontSize: '22px', fontFamily: FONT, color: '#ffd700',
    stroke: '#000000', strokeThickness: 8,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(91)

  scene.add.text(cx, cy - 140, 'You found the Silly Dragon!', {
    fontSize: '9px', fontFamily: FONT, color: '#ffffff',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setScrollFactor(0).setDepth(91)

  const enemiesKilled: number     = scene.registry.get('enemiesKilled')     ?? 0
  const hitsTaken: number         = scene.registry.get('hitsTaken')         ?? 0
  const furnitureDestroyed: number = scene.registry.get('furnitureDestroyed') ?? 0
  const goldCoins: number         = scene.registry.get('goldCoins')         ?? 0
  const pizzasConsumed: number    = scene.registry.get('pizzasCollected')   ?? 0
  const startTime: number         = scene.registry.get('runStartTime')      ?? Date.now()

  const mathKeys = [
    'level4Problem1Solved', 'level4Problem2Solved', 'level4Problem3Solved',
    'sunsetProblem1Solved', 'sunsetProblem2Solved', 'sunsetProblem3Solved',
    'sunsetProblem4Solved', 'sunsetProblem5Solved',
  ]
  const mathSolved = mathKeys.filter(k => !!scene.registry.get(k)).length

  const wordKeys = [
    'hasLevel1Key', 'hasLevel2Key', 'level3WordSolved',
    'hasLevel4Key', 'hasLevel8Key', 'hasLevel9Key', 'hasLevel10Key',
    'level5WordSolved', 'level6WordSolved', 'level7WordSolved',
  ]
  const wordSolved = wordKeys.filter(k => !!scene.registry.get(k)).length

  const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
  const isNewBest  = recordRunTime(elapsedSec)
  const bestSec    = loadSettings().bestTimeSec ?? elapsedSec
  const timeStr    = formatDuration(elapsedSec) + (isNewBest ? '  NEW BEST!' : '')

  const stats = [
    { label: 'Enemies slain',        value: `${enemiesKilled}`           },
    { label: 'Furniture destroyed',  value: `${furnitureDestroyed}`      },
    { label: 'Pizzas consumed',      value: `${pizzasConsumed}`          },
    { label: 'Coins collected',      value: `${goldCoins}`               },
    { label: 'Math puzzles solved',  value: `${mathSolved} / ${mathKeys.length}` },
    { label: 'Word puzzles solved',  value: `${wordSolved} / ${wordKeys.length}` },
    { label: 'Times hit',            value: `${hitsTaken}`               },
    { label: 'Time to Silly Dragon', value: timeStr                      },
    { label: 'Best time',            value: formatDuration(bestSec)      },
  ]
  stats.forEach(({ label, value }, i) => {
    const y = cy - 100 + i * 26
    scene.add.text(cx - 20, y, label, {
      fontSize: '8px', fontFamily: FONT, color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(91)
    scene.add.text(cx + 20, y, value, {
      fontSize: '8px', fontFamily: FONT, color: '#ffe066',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(91)
  })

  const btnMenu = scene.add.text(cx, cy + 120, 'MAIN MENU', {
    fontSize: '10px', fontFamily: FONT, color: '#ffffff',
    stroke: '#000000', strokeThickness: 3,
    backgroundColor: '#00000066', padding: { x: 16, y: 12 },
  }).setOrigin(0.5).setScrollFactor(0).setDepth(91)
    .setInteractive({ useHandCursor: true }).setAlpha(0)

  btnMenu.on('pointerover', () => btnMenu.setColor('#ffe066'))
  btnMenu.on('pointerout',  () => btnMenu.setColor('#ffffff'))
  let leaving = false
  btnMenu.on('pointerdown', () => {
    if (leaving) return
    leaving = true
    scene.cameras.main.fadeOut(400, 0, 0, 0)
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      resetRunState(scene.registry)
      scene.scene.start('MenuScene')
    })
  })

  new MenuNav(scene, { depth: 92 }).setItems([{ text: btnMenu, action: () => btnMenu.emit('pointerdown') }])

  scene.tweens.add({ targets: btnMenu, alpha: 1, duration: 400, delay: 200 })
}
