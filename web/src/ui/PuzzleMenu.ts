import Phaser from 'phaser'
import { SoundManager } from '../audio/SoundManager'
import { onKeyPress } from '../input/keys'

const FONT = '"Press Start 2P", monospace'

/** D-pad / stick navigation for whichever puzzle is open (driven by GameScene's gamepad events). */
export interface MenuNav {
  up: () => void
  down: () => void
  left?: () => void
  right?: () => void
  confirm: () => void
}

type KeyListener = { key: string; fn: () => void }

/**
 * Full-screen puzzle overlays: the magic-jar word puzzle and the duck math
 * challenge. Gameplay is paused while one is open (via the pause/resume hooks).
 */
export class PuzzleMenu {
  private objects: Phaser.GameObjects.GameObject[] = []
  /** Gamepad navigation for the open menu, or null when none is open. */
  nav: MenuNav | null = null

  constructor(
    private scene: Phaser.Scene,
    private hooks: { pause: () => void; resume: () => void },
  ) {}

  get isOpen(): boolean {
    return this.objects.length > 0
  }

  private offKeys: (() => void) | null = null

  /** Listens for the menu's keys ('keydown-LEFT' style names) until close(). */
  private listen(keyListeners: KeyListener[]) {
    const codeFor = (name: string) => {
      const k = name.replace('keydown-', '')
      const named: Record<string, string> = { LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown', ENTER: 'Enter', SPACE: 'Space' }
      return named[k] ?? `Key${k}`
    }
    const byCode = new Map(keyListeners.map(({ key, fn }) => [codeFor(key), fn]))
    this.offKeys?.()
    this.offKeys = onKeyPress(this.scene, e => byCode.get(e.code)?.())
  }

  private close(_keyListeners: KeyListener[]) {
    this.objects.forEach(o => { if (o.active) o.destroy() })
    this.objects = []
    this.nav = null
    this.offKeys?.()
    this.offKeys = null
    this.hooks.resume()
  }

  /** "Magic jar" word puzzle: pick the collected letter tiles in order to spell `targetWord`. */
  showWord(targetWord: string, collected: string[], onSolved: () => void) {
    if (this.isOpen) return

    const { width, height } = this.scene.scale
    const D    = 150
    const TILE = 64
    const GAP  = 14

    this.hooks.pause()

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(D).setInteractive()

    const title = this.scene.add.text(width / 2, height * 0.18, 'MAGIC JAR!', {
      fontSize: '34px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    const sub = this.scene.add.text(width / 2, height * 0.27, 'Spell the word:', {
      fontSize: '14px', fontFamily: FONT, color: '#aabbcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    // Target word displayed clearly
    const wordDisplay = this.scene.add.text(width / 2, height * 0.36, targetWord, {
      fontSize: '34px', fontFamily: FONT, color: '#ffffff',
      stroke: '#000', strokeThickness: 4,
      letterSpacing: 20,
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
      const box = this.scene.add.rectangle(sx, slotY, TILE, TILE, 0x141428)
        .setStrokeStyle(2, 0x334455).setScrollFactor(0).setDepth(D)
      const txt = this.scene.add.text(sx, slotY, '_', {
        fontSize: '26px', fontFamily: FONT, color: '#334455',
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
      const box = this.scene.add.rectangle(tx, tileY, TILE, TILE, 0x223344)
        .setStrokeStyle(2, 0x556677).setScrollFactor(0).setDepth(D).setInteractive({ useHandCursor: true })
      const txt = this.scene.add.text(tx, tileY, collected[i], {
        fontSize: '24px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      tileBoxes.push(box)
      tileTxts.push(txt)
    }

    const hint = this.scene.add.text(width / 2, height * 0.76,
      '\u2190 \u2192 to move   ENTER / tap to select', {
      fontSize: '13px', fontFamily: FONT, color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    this.objects = [overlay, title, sub, wordDisplay, hint, ...slotBoxes, ...slotTexts, ...tileBoxes, ...tileTxts]

    SoundManager.duckMusic()
    SoundManager.speakWord(targetWord)

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
      SoundManager.stopSpeech()
      SoundManager.unduckMusic()
      this.close(keyListeners)
    }

    const shake = () => {
      if (shaking) return
      shaking = true
      this.scene.tweens.add({
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
          this.scene.time.delayedCall(300, () => {
            closeMenu()
            SoundManager.collectAbility()
            onSolved()
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
        this.scene.time.delayedCall(350, () => { if (!usedSet.has(i)) applyTileStyle(i) })
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
    this.listen(keyListeners)

    this.nav = { up: onLeft, down: onRight, left: onLeft, right: onRight, confirm: onEnter }
  }

  private makeDistractors(correct: number, count: number): number[] {
    const used = new Set<number>([correct])
    const dists: number[] = []
    let offset = 1
    while (dists.length < count && offset < 30) {
      if (correct - offset > 0 && !used.has(correct - offset)) {
        dists.push(correct - offset); used.add(correct - offset)
      }
      if (dists.length < count && !used.has(correct + offset)) {
        dists.push(correct + offset); used.add(correct + offset)
      }
      offset++
    }
    return dists
  }

  /** Math challenge: pick the right answer to `question` from four choices. */
  showArithmetic(question: string, correct: number, onCorrect: () => void) {
    if (this.isOpen) return

    const { width, height } = this.scene.scale
    const D    = 150
    const TILE = 64
    const GAP  = 16

    const distractors = this.makeDistractors(correct, 3)
    const choices = Phaser.Utils.Array.Shuffle([correct, ...distractors]) as number[]
    const correctIdx = choices.indexOf(correct)

    this.hooks.pause()

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(D).setInteractive()

    const title = this.scene.add.text(width / 2, height * 0.20, 'MATH CHALLENGE!', {
      fontSize: '24px', fontFamily: FONT, color: '#ffe066', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    const qText = this.scene.add.text(width / 2, height * 0.37, `${question} = ?`, {
      fontSize: '36px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    const rewardTxt = this.scene.add.text(width / 2, height * 0.50, 'Reward: GOLD COINS!', {
      fontSize: '10px', fontFamily: FONT, color: '#aaffcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    const N = 4
    const tileRowW   = N * TILE + (N - 1) * GAP
    const tileStartX = width / 2 - tileRowW / 2 + TILE / 2
    const tileY = height * 0.65

    const tileBoxes: Phaser.GameObjects.Rectangle[] = []
    const tileTxts:  Phaser.GameObjects.Text[]      = []
    for (let i = 0; i < N; i++) {
      const tx  = tileStartX + i * (TILE + GAP)
      const box = this.scene.add.rectangle(tx, tileY, TILE, TILE, 0x223344)
        .setStrokeStyle(2, 0x556677).setScrollFactor(0).setDepth(D).setInteractive({ useHandCursor: true })
      const txt = this.scene.add.text(tx, tileY, `${choices[i]}`, {
        fontSize: '20px', fontFamily: FONT, color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1)
      tileBoxes.push(box); tileTxts.push(txt)
    }

    const hint = this.scene.add.text(width / 2, height * 0.78, '← → to move   ENTER / tap to select', {
      fontSize: '9px', fontFamily: FONT, color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D)

    this.objects = [overlay, title, qText, rewardTxt, hint, ...tileBoxes, ...tileTxts]

    let focusIdx = 0
    let shaking  = false
    const keyListeners: { key: string; fn: () => void }[] = []

    const applyStyle = (i: number) => {
      if (i === focusIdx) {
        tileBoxes[i].setFillStyle(0x2a3d55).setStrokeStyle(3, 0xffe066)
        tileTxts[i].setColor('#ffe066')
      } else {
        tileBoxes[i].setFillStyle(0x223344).setStrokeStyle(2, 0x556677)
        tileTxts[i].setColor('#ffffff')
      }
    }

    const moveFocus = (idx: number) => {
      if (shaking) return
      const prev = focusIdx; focusIdx = idx
      applyStyle(prev); applyStyle(idx)
    }

    const closeMenu = () => this.close(keyListeners)

    const shake = () => {
      if (shaking) return
      shaking = true
      this.scene.tweens.add({
        targets: [...tileBoxes, ...tileTxts],
        x: '+=7', duration: 35, yoyo: true, repeat: 4, ease: 'Linear',
        onComplete: () => { shaking = false; applyStyle(focusIdx) },
      })
    }

    const pick = (i: number) => {
      if (shaking) return
      if (i === correctIdx) {
        tileBoxes[i].setFillStyle(0x1a3a1a).setStrokeStyle(2, 0x44cc44)
        tileTxts[i].setColor('#44cc44')
        this.scene.time.delayedCall(400, () => {
          closeMenu()
          SoundManager.collectAbility()
          onCorrect()
        })
      } else {
        tileBoxes[i].setFillStyle(0x440000).setStrokeStyle(2, 0xff4444)
        tileTxts[i].setColor('#ff4444')
        shake()
        this.scene.time.delayedCall(350, () => { if (!shaking) applyStyle(i) })
      }
    }

    tileBoxes.forEach((box, i) => {
      box.on('pointerover', () => { if (!shaking) moveFocus(i) })
      box.on('pointerdown', () => pick(i))
    })

    moveFocus(0)

    const onLeft  = () => { if (!shaking) moveFocus((focusIdx - 1 + N) % N) }
    const onRight = () => { if (!shaking) moveFocus((focusIdx + 1) % N) }
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
    this.listen(keyListeners)
    this.nav = { up: onLeft, down: onRight, left: onLeft, right: onRight, confirm: onEnter }
  }
}
