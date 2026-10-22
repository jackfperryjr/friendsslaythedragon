import Phaser from 'phaser'
import type { RoomConfig } from '../levels'

// Purely decorative drawing for GameScene: skies, torches, tile shading, doors.
// Nothing here affects physics or gameplay.

/** Outdoor rooms paint a sky behind the tilemap; indoor rooms use the tilemap's own background layer. */
export function drawOutdoorSky(scene: Phaser.Scene, cfg: RoomConfig) {
  if (!cfg.isOutdoor) return
  const { width, height } = scene.scale
  const cx = width / 2, cy = height / 2

  // depth -1: sits above the tilemap 'Sky' background layer (-2) but below solid tiles (1)
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-1)

  if (cfg.isSunset) {
    // ── Sunset sky: blue at top fading through yellow to warm horizon ──
    g.fillGradientStyle(0x1a3a6e, 0x1a3a6e, 0x6b8cc0, 0x6b8cc0, 1, 1, 1, 1)
    g.fillRect(0, 0, width, height * 0.42)
    g.fillGradientStyle(0x6b8cc0, 0x6b8cc0, 0xffe060, 0xffe060, 1, 1, 1, 1)
    g.fillRect(0, height * 0.42, width, height * 0.33)
    g.fillGradientStyle(0xffe060, 0xffe060, 0xffc030, 0xffc030, 1, 1, 1, 1)
    g.fillRect(0, height * 0.75, width, height * 0.25)

    // Sun — bright yellow-white glow
    const sunX = width * 0.82, sunY = height * 0.78
    const sunG = scene.add.graphics().setScrollFactor(0).setDepth(-1)
    sunG.fillStyle(0xffff80, 0.12); sunG.fillCircle(sunX, sunY, 110)
    sunG.fillStyle(0xffee40, 0.22); sunG.fillCircle(sunX, sunY, 76)
    sunG.fillStyle(0xffe000, 0.40); sunG.fillCircle(sunX, sunY, 50)
    sunG.fillStyle(0xffd000, 0.65); sunG.fillCircle(sunX, sunY, 28)
    sunG.fillStyle(0xffffa0, 0.95); sunG.fillCircle(sunX, sunY, 14)
    scene.tweens.add({ targets: sunG, alpha: 0.82, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    // Horizon glow — yellow
    const hG = scene.add.graphics().setScrollFactor(0).setDepth(-1)
    hG.fillStyle(0xffe040, 0.28); hG.fillEllipse(sunX, sunY, 720, 140)
    hG.fillStyle(0xffcc20, 0.16); hG.fillEllipse(sunX, sunY, 480, 90)

    // Yellow-toned sunset clouds
    const cloudG = scene.add.graphics().setScrollFactor(0).setDepth(-1)
    const drawSunCloud = (clx: number, cly: number, wr: number, hr: number, col: number, a: number) => {
      cloudG.fillStyle(col, a)
      cloudG.fillEllipse(clx, cly, wr, hr)
      cloudG.fillEllipse(clx - wr * 0.28, cly + hr * 0.18, wr * 0.55, hr * 0.65)
      cloudG.fillEllipse(clx + wr * 0.28, cly + hr * 0.18, wr * 0.55, hr * 0.65)
    }
    drawSunCloud(width * 0.10, height * 0.40, 220, 70, 0xffe090, 0.50)
    drawSunCloud(width * 0.35, height * 0.24, 180, 58, 0xffd870, 0.45)
    drawSunCloud(width * 0.60, height * 0.44, 240, 76, 0xffcc50, 0.50)
    drawSunCloud(width * 0.83, height * 0.30, 160, 52, 0xffe880, 0.42)
    scene.tweens.add({ targets: cloudG, alpha: 0.72, duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    // Yellow ambient wash over the scene
    scene.add.rectangle(cx, cy, width, height, 0xffe060, 0.22).setScrollFactor(0).setDepth(-1)

  } else {
    // ── Night sky: near-black top, deep purple horizon ────────────────────
    g.fillGradientStyle(0x06020f, 0x06020f, 0x1a0838, 0x1a0838, 1, 1, 1, 1)
    g.fillRect(0, 0, width, height)

    // Stars — two layers that twinkle at different rates
    const makeStarLayer = (seed: number, count: number) => {
      const sg = scene.add.graphics().setScrollFactor(0).setDepth(-1)
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
    scene.tweens.add({ targets: stars1, alpha: 0.20, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    scene.tweens.add({ targets: stars2, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1, delay: 700, ease: 'Sine.InOut' })

    // Clouds — barely-visible lavender
    const cloudG = scene.add.graphics().setScrollFactor(0).setDepth(-1)
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
    scene.tweens.add({ targets: cloudG, alpha: 0.30, duration: 4500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
  }
}

/** Wall torches for the coloured and dark castle levels. */
export function drawTorches(scene: Phaser.Scene, cfg: RoomConfig, isInsideWall: (x: number, y: number) => boolean) {
  if ((!cfg.isDark && !cfg.isRed && !cfg.isOrange && !cfg.isGreen && !cfg.isBlue) || cfg.isBossRoom) return
  const W = cfg.worldWidth

  if (cfg.isRed || cfg.isOrange || cfg.isGreen || cfg.isBlue) {
    if (cfg.isOrange && cfg.worldMap) {
      // Vertical world-map level: spread torches down the play area
      const startY = (cfg.defaultSpawn?.y ?? 3004) - 50
      const endY   = (cfg.worldHeight ?? 8416) - 600
      let idx = 0
      for (let y = startY; y < endY; y += 900) {
        for (let x = 400; x < W - 300; x += 1200) {
          // Scan horizontally for a clear spot (±96px in 32px steps)
          let tx = x
          const offsets = [0, 32, -32, 64, -64, 96, -96]
          const clear = offsets.find(ox => !isInsideWall(x + ox, y))
          if (clear === undefined) continue
          tx = x + clear
          spawnTorch(scene, tx, y, idx * 200)
          idx++
        }
      }
      return
    }
    // Fixed bands near the active play area — derived from defaultSpawn Y for large maps
    const spawnY = cfg.defaultSpawn?.y ?? 500
    const band1 = spawnY - 200, band2 = spawnY - 80
    const bands = [band1, band2]
    const offsets = [0, 32, -32, 64, -64, 96, -96]
    let idx = 0
    for (let x = 300; x < W - 200; x += 1200) {
      const ty = bands[idx % bands.length]
      const clear = offsets.find(ox => !isInsideWall(x + ox, ty))
      if (clear !== undefined) spawnTorch(scene, x + clear, ty, idx * 220)
      idx++
    }
    return
  }

  const H = cfg.worldHeight ?? 1856
  // Three height bands; first band nudged up 35px
  const bands = [H * 0.14 - 35, H * 0.44, H * 0.74]
  let idx = 0
  for (let x = 220; x < W - 100; x += 480) {
    spawnTorch(scene, x, bands[idx % bands.length], idx * 180)
    idx++
  }
}

function spawnTorch(scene: Phaser.Scene, x: number, y: number, flickerOffset: number) {
  // Gradient glow — concentric rings, additive blend, single object for flicker
  const glow = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
  glow.fillStyle(0x441400, 0.22); glow.fillCircle(x, y - 8, 56)
  glow.fillStyle(0xff4400, 0.18); glow.fillCircle(x, y - 8, 42)
  glow.fillStyle(0xff8800, 0.22); glow.fillCircle(x, y - 8, 30)
  glow.fillStyle(0xffcc44, 0.28); glow.fillCircle(x, y - 8, 18)
  glow.fillStyle(0xffffff, 0.20); glow.fillCircle(x, y - 8, 8)

  // Torch bracket + handle (static)
  const body = scene.add.graphics().setDepth(2)
  body.fillStyle(0x4a3420, 1); body.fillRect(x - 2, y, 4, 14)
  body.fillStyle(0x6a4e30, 1); body.fillRect(x - 5, y - 5, 10, 6)

  // Flame — static, no tween
  const flame = scene.add.graphics().setDepth(3)
  flame.fillStyle(0xff8800, 0.90); flame.fillEllipse(x, y - 13, 9, 13)
  flame.fillStyle(0xffee44, 0.85); flame.fillEllipse(x, y - 17, 5, 8)
  flame.fillStyle(0xffffff, 0.55); flame.fillEllipse(x, y - 20, 3, 5)

  // Only the glow flickers
  scene.tweens.add({
    targets: glow,
    alpha: 0.42,
    duration: 130 + (flickerOffset % 80),
    yoyo: true, repeat: -1, delay: flickerOffset % 350, ease: 'Sine.InOut',
  })
}

/**
 * Gradient shadow strips along every exposed tile face, to give the flat tiles depth.
 * Adjacent tiles in a row/column are merged into one rect per slice.
 */
export function drawTileDepthShadows(
  scene: Phaser.Scene,
  layers: Phaser.Tilemaps.TilemapLayer[],
  tw: number, th: number,
  ox: number, oy: number,
) {
  if (layers.length === 0) return

  const cols = layers[0].layer.width
  const rows = layers[0].layer.height

  const solid = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false
    return layers.some(l => { const t = l.getTileAt(c, r); return t !== null && t.index >= 0 })
  }

  const gfx = scene.add.graphics().setDepth(1.5)
  const SH = Math.max(5, Math.round(th * 0.28))  // total bottom/top shadow extent in px
  const SW = Math.max(4, Math.round(tw * 0.22))  // total left/right shadow extent in px

  // Alpha steps from wall face outward — darkest at the surface, fading to transparent
  const ALPHAS = [0.38, 0.26, 0.16, 0.08, 0.03]
  const N = ALPHAS.length
  const stepH = Math.max(1, Math.ceil(SH / N))
  const stepW = Math.max(1, Math.ceil(SW / N))

  // Bottom shadows: fades downward into the empty space below the face
  for (let r = 0; r < rows; r++) {
    let run = -1
    for (let c = 0; c <= cols; c++) {
      const edge = c < cols && solid(c, r) && !solid(c, r + 1)
      if (edge && run === -1) { run = c }
      else if (!edge && run !== -1) {
        const rx = ox + run * tw, rw = (c - run) * tw, ry = oy + (r + 1) * th
        for (let i = 0; i < N; i++) {
          gfx.fillStyle(0x000000, ALPHAS[i])
          gfx.fillRect(rx, ry + i * stepH, rw, stepH)
        }
        run = -1
      }
    }
  }

  // Right shadows: fades rightward into the empty space beside the face
  for (let c = 0; c < cols; c++) {
    let run = -1
    for (let r = 0; r <= rows; r++) {
      const edge = r < rows && solid(c, r) && !solid(c + 1, r)
      if (edge && run === -1) { run = r }
      else if (!edge && run !== -1) {
        const ry = oy + run * th, rh = (r - run) * th, rx = ox + (c + 1) * tw
        for (let i = 0; i < N; i++) {
          gfx.fillStyle(0x000000, ALPHAS[i])
          gfx.fillRect(rx + i * stepW, ry, stepW, rh)
        }
        run = -1
      }
    }
  }

  // Left shadows: fades leftward into the empty space beside the face
  for (let c = 0; c < cols; c++) {
    let run = -1
    for (let r = 0; r <= rows; r++) {
      const edge = r < rows && solid(c, r) && !solid(c - 1, r)
      if (edge && run === -1) { run = r }
      else if (!edge && run !== -1) {
        const ry = oy + run * th, rh = (r - run) * th, rx = ox + c * tw
        for (let i = 0; i < N; i++) {
          gfx.fillStyle(0x000000, ALPHAS[i])
          gfx.fillRect(rx - (i + 1) * stepW, ry, stepW, rh)
        }
        run = -1
      }
    }
  }

  // Top shadows: fades upward into the empty space above the face
  for (let r = 0; r < rows; r++) {
    let run = -1
    for (let c = 0; c <= cols; c++) {
      const edge = c < cols && solid(c, r) && !solid(c, r - 1)
      if (edge && run === -1) { run = c }
      else if (!edge && run !== -1) {
        const rx = ox + run * tw, rw = (c - run) * tw, ry = oy + r * th
        for (let i = 0; i < N; i++) {
          gfx.fillStyle(0x000000, ALPHAS[i])
          gfx.fillRect(rx, ry - (i + 1) * stepH, rw, stepH)
        }
        run = -1
      }
    }
  }
}

/** Outdoor maps: paints every solid tile as grass-topped dirt (warm palette at sunset, twilight otherwise). */
export function paintOutdoorTiles(
  scene: Phaser.Scene,
  solidLayer: Phaser.Tilemaps.TilemapLayer,
  tw: number, th: number,
  ox: number, oy: number,
  sunset: boolean,
) {
  const cols = solidLayer.layer.width
  const rows = solidLayer.layer.height
  const tileG = scene.add.graphics().setDepth(2)

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
        if (sunset) {
          // ── Surface tile (sunset / warm palette) ──────────────────
          tileG.fillStyle(0x7a4a28); tileG.fillRect(wx, wy +  9, tw, 9)   // topsoil (warm terracotta)
          tileG.fillStyle(0x5c3418); tileG.fillRect(wx, wy + 18, tw, 7)   // upper dirt
          tileG.fillStyle(0x42240e); tileG.fillRect(wx, wy + 25, tw, 4)   // lower dirt
          tileG.fillStyle(0x2c1608); tileG.fillRect(wx, wy + 29, tw, th - 29) // deep

          tileG.fillStyle(0x4a2c10)
          const firstS = Math.ceil((wy + 15) / 8) * 8
          for (let sy = firstS; sy < wy + th - 1; sy += 8) {
            tileG.fillRect(wx + 2, sy, tw - 4, 1)
          }
          tileG.fillStyle(0x9a6038); tileG.fillRect(wx, wy + 15, 1, th - 15)
          tileG.fillStyle(0x1e0e04); tileG.fillRect(wx, wy + th - 2, tw, 2)

          tileG.fillStyle(0x6a3820)
          tileG.fillRect(wx + px1, wy + 16 + py1 % (th - 20), 2, 2)
          tileG.fillRect(wx + px2, wy + 16 + py2 % (th - 20), 2, 2)
          tileG.fillStyle(0xc07840)
          tileG.fillRect(wx + px3, wy + 16 + py3 % (th - 20), 1, 1)

          // ── Grass cap (warm golden-green) ──────────────────────────
          tileG.fillStyle(0x7aaa20); tileG.fillRect(wx + 2, wy,     tw - 4, 1)
          tileG.fillStyle(0x7aaa20); tileG.fillRect(wx + 1, wy + 1, tw - 2, 1)
          tileG.fillStyle(0x7aaa20); tileG.fillRect(wx,     wy + 2, tw, 2)
          tileG.fillStyle(0x5e8418); tileG.fillRect(wx,     wy + 4, tw, 2)
          tileG.fillStyle(0x425c10); tileG.fillRect(wx,     wy + 6, tw, 3)

          const numG = Math.ceil(tw / 4)
          for (let gi = 0; gi < numG; gi++) {
            const gx    = wx + gi * 4
            const gw    = Math.min(4, tw - gi * 4)
            const gseed = (c * 37 + r * 13 + gi * 7) & 0x7
            const yVar  = (gseed % 5) - 2
            tileG.fillStyle(0x2e3e08); tileG.fillRect(gx, wy + 9  + yVar, gw, 2)
            tileG.fillStyle(0x4a6010); tileG.fillRect(gx, wy + 11 + yVar, gw, 2)
          }
          tileG.fillStyle(0xa0cc30); tileG.fillRect(wx + 2, wy, Math.floor(tw * 0.35), 1)

        } else {
          // ── Surface tile (twilight palette) ───────────────────────
          tileG.fillStyle(0x3a2448); tileG.fillRect(wx, wy +  9, tw, 9)
          tileG.fillStyle(0x2c1838); tileG.fillRect(wx, wy + 18, tw, 7)
          tileG.fillStyle(0x22122c); tileG.fillRect(wx, wy + 25, tw, 4)
          tileG.fillStyle(0x180c20); tileG.fillRect(wx, wy + 29, tw, th - 29)

          tileG.fillStyle(0x281040)
          const firstS = Math.ceil((wy + 15) / 8) * 8
          for (let sy = firstS; sy < wy + th - 1; sy += 8) {
            tileG.fillRect(wx + 2, sy, tw - 4, 1)
          }
          tileG.fillStyle(0x4a2c68); tileG.fillRect(wx, wy + 15, 1, th - 15)
          tileG.fillStyle(0x140a1c); tileG.fillRect(wx, wy + th - 2, tw, 2)

          tileG.fillStyle(0x201040)
          tileG.fillRect(wx + px1, wy + 16 + py1 % (th - 20), 2, 2)
          tileG.fillRect(wx + px2, wy + 16 + py2 % (th - 20), 2, 2)
          tileG.fillStyle(0x6040a0)
          tileG.fillRect(wx + px3, wy + 16 + py3 % (th - 20), 1, 1)

          tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx + 2, wy,     tw - 4, 1)
          tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx + 1, wy + 1, tw - 2, 1)
          tileG.fillStyle(0x2a5c3c); tileG.fillRect(wx,     wy + 2, tw, 2)
          tileG.fillStyle(0x1e4228); tileG.fillRect(wx,     wy + 4, tw, 2)
          tileG.fillStyle(0x142e1c); tileG.fillRect(wx,     wy + 6, tw, 3)

          const numG = Math.ceil(tw / 4)
          for (let gi = 0; gi < numG; gi++) {
            const gx    = wx + gi * 4
            const gw    = Math.min(4, tw - gi * 4)
            const gseed = (c * 37 + r * 13 + gi * 7) & 0x7
            const yVar  = (gseed % 5) - 2
            tileG.fillStyle(0x0e2018); tileG.fillRect(gx, wy + 9  + yVar, gw, 2)
            tileG.fillStyle(0x1a2e20); tileG.fillRect(gx, wy + 11 + yVar, gw, 2)
          }
          tileG.fillStyle(0x3a7050); tileG.fillRect(wx + 2, wy, Math.floor(tw * 0.35), 1)
        }

      } else if (fullyInner) {
        // ── Fully surrounded ──────────────────────────────────────────
        tileG.fillStyle(sunset ? 0x2c1608 : 0x1a0a28); tileG.fillRect(wx, wy, tw, th)

        tileG.fillStyle(sunset ? 0x1e0e04 : 0x120818)
        const firstS2 = Math.ceil(wy / 8) * 8
        for (let sy = firstS2; sy < wy + th - 1; sy += 8) {
          tileG.fillRect(wx + 2, sy, tw - 4, 1)
        }

        tileG.fillStyle(sunset ? 0x4a2810 : 0x281848)
        tileG.fillRect(wx + px1, wy + py1, 2, 2)
        tileG.fillRect(wx + px2, wy + py2, 2, 2)
        tileG.fillStyle(sunset ? 0x200e04 : 0x140a24)
        tileG.fillRect(wx + px3, wy + py3, 1, 1)

      } else {
        // ── Partially exposed edge tile ────────────────────────────────
        tileG.fillStyle(sunset ? 0x4a2c14 : 0x2a1838); tileG.fillRect(wx, wy, tw, th)

        tileG.fillStyle(sunset ? 0x361e08 : 0x201040)
        const firstS3 = Math.ceil(wy / 8) * 8
        for (let sy = firstS3; sy < wy + th - 1; sy += 8) {
          tileG.fillRect(wx + 2, sy, tw - 4, 1)
        }

        tileG.fillStyle(sunset ? 0x2c1608 : 0x160c20)
        tileG.fillRect(wx + px1, wy + py1, 2, 2)
        tileG.fillRect(wx + px2, wy + py2, 2, 2)
        tileG.fillStyle(sunset ? 0x8a5030 : 0x4a3068)
        tileG.fillRect(wx + px3, wy + py3, 1, 1)
        tileG.fillStyle(sunset ? 0x7a4828 : 0x3a2460); tileG.fillRect(wx, wy, 1, th)
      }
    }
  }
}

/**
 * Arched double door with iron bands and ring knockers, drawn with its base at (x, y).
 * 'boss' glows red, 'cave' is a grey rock entrance (sunset fields), 'plain' has no glow.
 */
export function drawCastleDoor(scene: Phaser.Scene, x: number, y: number, style: 'boss' | 'cave' | 'plain') {
  const cy = y - 106  // door center

  // Gradient glow radiating from arch (top/sides only, clipped at arch base)
  const archBottom = cy + 140
  const archGlow = scene.add.graphics().setDepth(-1)
  if (style === 'cave') {
    // Cave entrance: cool grey-slate shadow instead of fiery red
    for (let gi = 11; gi >= 0; gi--) {
      const t = gi / 11
      const exp = t * 90
      archGlow.fillStyle(0x1e2028, (1 - t) * 0.52 + 0.04)
      archGlow.fillRoundedRect(
        x - 84 - exp, cy - 138 - exp,
        168 + 2 * exp, (archBottom - (cy - 138)) + exp,
        { tl: 72 + exp, tr: 72 + exp, bl: 0, br: 0 },
      )
    }
    // Static — cave mouths don't flicker

    // Rocky cliff face flanking the entrance
    const rk = scene.add.graphics().setDepth(1)
    // Left rock mass — three receding layers
    rk.fillStyle(0x4a4a48, 1); rk.fillRect(x - 112, cy - 30, 32, 170)
    rk.fillStyle(0x363634, 1); rk.fillRect(x - 120, cy + 10, 20, 120)
    rk.fillStyle(0x282826, 1); rk.fillRect(x - 126, cy + 40, 14, 90)
    // Left rock top caps (jagged silhouette via overlapping rects)
    rk.fillStyle(0x4a4a48, 1)
    rk.fillRect(x - 116, cy - 50, 18, 24); rk.fillRect(x - 104, cy - 62, 16, 36)
    rk.fillRect(x - 124, cy - 38, 12, 14)
    // Right rock mass
    rk.fillStyle(0x4a4a48, 1); rk.fillRect(x + 80,  cy - 30, 32, 170)
    rk.fillStyle(0x363634, 1); rk.fillRect(x + 100, cy + 10, 20, 120)
    rk.fillStyle(0x282826, 1); rk.fillRect(x + 112, cy + 40, 14, 90)
    // Right rock top caps
    rk.fillStyle(0x4a4a48, 1)
    rk.fillRect(x + 98,  cy - 50, 18, 24); rk.fillRect(x + 88, cy - 62, 16, 36)
    rk.fillRect(x + 112, cy - 38, 12, 14)
    // Lintel slab across the top of the opening
    rk.fillStyle(0x404040, 1); rk.fillRect(x - 84, cy - 152, 168, 18)
    rk.fillStyle(0x303030, 1); rk.fillRect(x - 78, cy - 162, 156, 12)
    // Crack details
    rk.fillStyle(0x202020, 0.60)
    rk.fillRect(x - 98, cy - 10, 2, 60); rk.fillRect(x - 92, cy + 20, 2, 40)
    rk.fillRect(x + 90, cy - 10, 2, 60); rk.fillRect(x + 96, cy + 20, 2, 40)

    // Arch: cool grey stone
    const arch = scene.add.graphics().setDepth(2)
    arch.fillStyle(0x3c3c3e, 1)
    arch.fillRoundedRect(x - 84, cy - 138, 168, 278, { tl: 72, tr: 72, bl: 0, br: 0 })
    arch.fillStyle(0x1a1a1c, 1)
    arch.fillRoundedRect(x - 74, cy - 130, 148, 264, { tl: 62, tr: 62, bl: 0, br: 0 })

    // Keystone at arch crown — grey
    scene.add.rectangle(x, cy - 132, 22, 20, 0x505054).setDepth(2)
    scene.add.rectangle(x, cy - 132, 12, 12, 0x6a6a70, 0.75).setDepth(2)
  } else {
    if (style === 'boss') {
      for (let gi = 11; gi >= 0; gi--) {
        const t   = gi / 11
        const exp = t * 90
        archGlow.fillStyle(0xff1100, (1 - t) * 0.35 + 0.02)
        archGlow.fillRoundedRect(
          x - 84 - exp, cy - 138 - exp,
          168 + 2 * exp, (archBottom - (cy - 138)) + exp,
          { tl: 72 + exp, tr: 72 + exp, bl: 0, br: 0 },
        )
      }
      scene.tweens.add({ targets: archGlow, alpha: { from: 0.55, to: 1.0 }, duration: 1200, yoyo: true, repeat: -1 })
    }

    // Stone arch frame: outer (depth 2), then inner recess overlaid on same graphic
    const arch = scene.add.graphics().setDepth(2)
    arch.fillStyle(0x2a1a0e, 1)
    arch.fillRoundedRect(x - 84, cy - 138, 168, 278, { tl: 72, tr: 72, bl: 0, br: 0 })
    arch.fillStyle(0x150903, 1)
    arch.fillRoundedRect(x - 74, cy - 130, 148, 264, { tl: 62, tr: 62, bl: 0, br: 0 })

    // Keystone at arch crown
    scene.add.rectangle(x, cy - 132, 22, 20, 0x3d2812).setDepth(2)
    scene.add.rectangle(x, cy - 132, 12, 12, 0x5a3c1e, 0.75).setDepth(2)
  }

  // Wood door panels — fill the rectangular portion of the inner arch opening
  // Inner arch rectangular portion starts at cy - 130 + 62 = cy - 68
  const panelTop = cy - 68
  const panelBot = cy + 134   // cy - 130 + 264
  const panelH   = panelBot - panelTop  // ≈ 202px

  const wp = scene.add.graphics().setDepth(2)
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
  scene.add.rectangle(x, panelTop + panelH / 2, 4, panelH, 0x120804).setDepth(2)

  // Iron banding across both panels (3 horizontal bands with rivets)
  const bandYs = [cy - 30, cy + 40, cy + 100]
  bandYs.forEach(by => {
    scene.add.rectangle(x, by,     140, 7, 0x252525).setDepth(2)
    scene.add.rectangle(x, by - 1, 140, 3, 0x3c3c3c, 0.50).setDepth(2)
    ;[x - 56, x - 28, x + 2, x + 30, x + 58].forEach(rx => {
      scene.add.circle(rx, by, 3, 0x2e2e2e).setDepth(2)
      scene.add.circle(rx, by, 1, 0x4c4c4c).setDepth(2)
    })
  })

  // Ring knockers — one per door panel
  ;[-30, 30].forEach(ox => {
    scene.add.circle(x + ox, cy + 38, 8, 0x8a6830).setDepth(2)
    scene.add.circle(x + ox, cy + 38, 5, 0x241508).setDepth(2)
    scene.add.circle(x + ox, cy + 46, 4, 0x8a6830).setDepth(2) // hanging ring
  })
}
