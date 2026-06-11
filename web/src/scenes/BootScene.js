import Phaser from 'phaser';
// ── SPRITE SHEET CONFIG ───────────────────────────────────────────────────────
// Step 1: Drop your PNGs into  web/public/assets/
// Step 2: Fill in FRAME_W, FRAME_H, and the frame ranges below
// Step 3: Flip SPRITES_CONFIGURED to true — animations won't load until you do
//
// Frames count left→right, top→bottom, starting at 0.
// Single-frame animation: { start: N, end: N }
const SPRITES_CONFIGURED = true;
// Player sheets — key becomes texture 'sheet-{key}', anim prefix 'char-{key}'
// New sprites: 256×256 with 16 views in a 4×4 grid → fw=64, fh=64
const SHEETS = {
    conrad: { file: 'conrad.png', fw: 64, fh: 64, selectable: true, name: 'CONRAD', previewFrame: 10 },
    carter: { file: 'carter.png', fw: 64, fh: 64, selectable: true, name: 'CARTER', previewFrame: 9,
        anim: {
            idle: { start: 15, end: 15 },
            walk: { start: 0, end: 7 },
            jump: { start: 9, end: 9 },
            float: { start: 11, end: 11 },
            inhale: { start: 12, end: 12 },
            puffed: { start: 7, end: 7 },
            fall: { start: 13, end: 13 },
            melee: { start: 10, end: 9 },
            ability: { start: 10, end: 9 },
        }
    },
    callum: { file: 'callum.png', fw: 64, fh: 64, selectable: true, name: 'CALLUM', previewFrame: 9,
        anim: {
            idle: { start: 0, end: 0 },
            walk: { start: 1, end: 6 },
            jump: { start: 10, end: 10 },
            float: { start: 11, end: 11 },
            inhale: { start: 9, end: 9 },
            puffed: { start: 9, end: 9 },
            fall: { start: 8, end: 8 },
            melee: { start: 12, end: 13 },
            ability: { start: 12, end: 13 },
        }
    },
    coco: { file: 'coco.png', fw: 64, fh: 64, selectable: true, name: 'COCO', previewFrame: 15,
        anim: {
            idle: { start: 6, end: 6 },
            walk: { start: 0, end: 6 },
            jump: { start: 10, end: 10 },
            float: { start: 12, end: 12 },
            inhale: { start: 14, end: 14 },
            puffed: { start: 14, end: 14 },
            fall: { start: 11, end: 11 },
            melee: { start: 13, end: 13 },
            ability: { start: 13, end: 13 },
        }
    },
    eric: { file: 'eric.png', fw: 64, fh: 64, selectable: true, name: 'ERIC', previewFrame: 15,
        anim: {
            idle: { start: 15, end: 15 },
            walk: { start: 0, end: 7 },
            jump: { start: 9, end: 9 },
            float: { start: 10, end: 10 },
            inhale: { start: 9, end: 9 },
            puffed: { start: 13, end: 13 },
            fall: { start: 12, end: 12 },
            melee: { start: 11, end: 11 },
            ability: { start: 11, end: 11 },
        }
    },
    abby: { file: 'abby.png', fw: 64, fh: 64, selectable: true, name: 'ABBY', previewFrame: 5,
        anim: {
            idle: { start: 5, end: 5 },
            walk: { start: 0, end: 2 },
            jump: { start: 9, end: 9 },
            float: { start: 7, end: 7 },
            inhale: { start: 8, end: 8 },
            puffed: { start: 8, end: 8 },
            fall: { start: 6, end: 6 },
            melee: { start: 10, end: 10 },
            ability: { start: 10, end: 10 },
        }
    },
    scarlett: { file: 'scarlett.png', fw: 64, fh: 64, selectable: true, name: 'SCARLETT', previewFrame: 15,
        anim: {
            idle: { start: 15, end: 15 },
            walk: { start: 1, end: 5 },
            jump: { start: 9, end: 9 },
            float: { start: 12, end: 12 },
            inhale: { start: 8, end: 8 },
            puffed: { start: 8, end: 8 },
            fall: { start: 11, end: 11 },
            melee: { start: 10, end: 10 },
            ability: { start: 10, end: 10 },
        }
    },
};
// Which sheet each player uses (falls back to generated texture if file is missing)
const PLAYER_SHEETS = {
    0: 'conrad',
    1: 'carter',
    2: 'callum',
    3: 'abby',
};
// 4×4 grid layout (frames 0-15, 64×64 each):
//  Row 0 (0–3)  — idle / walk cycle
//  Row 1 (4–7)  — jump / float / fall / shield
//  Row 2 (8–11) — (reserved for future poses)
//  Row 3 (12–15)— (reserved for puffed / special)
// Adjust start/end once you confirm the actual frame order in the sheet.
const ANIM_FRAMES = {
    idle: { start: 14, end: 14 },
    walk: { start: 0, end: 3 },
    jump: { start: 7, end: 7 },
    float: { start: 9, end: 9 },
    shield: { start: 10, end: 10 },
    puffed: { start: 10, end: 10 },
    fall: { start: 8, end: 8 },
    melee: { start: 12, end: 11 },
    ability: { start: 12, end: 11 },
};
// ── Enemy sheet config ────────────────────────────────────────────────────────
// Boss sprites: 256×256 total, 128×128 per frame (2×2 grid → 4 frames)
// Regular enemy sprites: 256×256 with 16 frames in a 4×4 grid → fw=64, fh=64
const ENEMY_SHEETS = [
    { key: 'sheet-enemy-zombie', file: 'enemies/zombie.png', fw: 64, fh: 64, walkStart: 11, walkEnd: 14 },
    { key: 'sheet-enemy-skeleton', file: 'enemies/skeleton.png', fw: 64, fh: 64, walkStart: 0, walkEnd: 7 },
    { key: 'sheet-celery', file: 'enemies/celery.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-king-zombie', file: 'enemies/king_zombie.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-king-skeleton', file: 'enemies/king_skeleton.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-enemy-bat', file: 'enemies/bat.png', fw: 64, fh: 64, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-red-dragon', file: 'enemies/red_dragon.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-gold-dragon', file: 'enemies/gold_dragon.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-black-dragon', file: 'enemies/black_dragon.png', fw: 64, fh: 64, walkStart: 0, walkEnd: 15 },
    // New bosses — 256×256, 128×128 frames
    { key: 'sheet-pac-dude', file: 'enemies/pac_dude.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-mushroom-man', file: 'enemies/mushroom_man.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-fowser', file: 'enemies/fowser.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-standing-man', file: 'enemies/standing_man.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
    { key: 'sheet-moving-man', file: 'enemies/moving_man.png', fw: 128, fh: 128, walkStart: 0, walkEnd: 3 },
];
// ─────────────────────────────────────────────────────────────────────────────
export class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'BootScene' }); }
    preload() {
        if (SPRITES_CONFIGURED) {
            for (const [key, { file, fw, fh }] of Object.entries(SHEETS)) {
                this.load.spritesheet(`sheet-${key}`, `assets/players/${file}`, { frameWidth: fw, frameHeight: fh });
            }
        }
        for (const { key, file, fw, fh } of ENEMY_SHEETS) {
            this.load.spritesheet(key, `assets/${file}`, { frameWidth: fw, frameHeight: fh });
        }
        for (const c of ['callum', 'carter', 'conrad', 'coco', 'abby', 'eric', 'scarlett']) {
            this.load.image(`head-${c}`, `assets/players/${c}_head.png`);
        }
        this.load.image('fire_ability_icon', 'assets/game_icons/fire_ability_icon.png');
        this.load.image('lightning_ability_icon', 'assets/game_icons/lightning_ability_icon.png');
        this.load.image('ice_ability_icon', 'assets/game_icons/ice_ability_icon.png');
        this.load.image('empty_ability_icon', 'assets/game_icons/empty_ability.png');
        this.load.image('speed_boost_icon', 'assets/game_icons/speed.png');
        this.load.image('strength_boost_icon', 'assets/game_icons/strength.png');
        this.load.image('invulnerability_icon', 'assets/game_icons/invulnerable.png');
        this.load.image('fire_ability', 'assets/game_icons/fire_ability.png');
        this.load.image('lightning_ability', 'assets/game_icons/lightning_ability.png');
        this.load.image('ice_ability', 'assets/game_icons/ice_ability.png');
        this.load.image('proj-fire', 'assets/projectiles/fireball.png');
        this.load.image('proj-ice', 'assets/projectiles/icecycle.png');
        this.load.image('proj-lightning', 'assets/projectiles/lightningbolt.png');
        this.load.spritesheet('sheet-truck-projectiles', 'assets/projectiles/army_truck_projectiles.png', { frameWidth: 64, frameHeight: 64 });
        this.load.image('spike-ball', 'assets/projectiles/spike_ball.png');
        this.load.image('spike-floor1', 'assets/projectiles/spike_floor1.png');
        this.load.image('spike-floor2', 'assets/projectiles/spike_floor2.png');
        this.load.image('item-pizza', 'assets/items/pizza.png');
        this.load.image('item-key-jar', 'assets/items/key_jar.png');
        this.load.image('item-key', 'assets/items/key.png');
        this.load.spritesheet('letter-bugs', 'assets/items/letter_bugs.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('chests', 'assets/items/chests.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('bookshelf', 'assets/items/bookshelf.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('table', 'assets/items/table.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('mimic', 'assets/enemies/mimic.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('npc-mom', 'assets/npcs/mom.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('npc-dad', 'assets/npcs/dad.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('npc-duck', 'assets/npcs/duck.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-carter-transform', 'assets/players/carter_transform.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-carter-dino-jump', 'assets/players/carter_dino_jump.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-eric-transformer', 'assets/players/eric_transformer.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-army-truck', 'assets/players/army_truck.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-conrad-transform', 'assets/players/conrad_transform.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-white-truck', 'assets/players/white_truck.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-white-tank', 'assets/players/white_tank.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-white-heli', 'assets/players/white_helicopter.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-trex', 'assets/players/trex.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-scarlett-transformer', 'assets/players/scarlett_transform.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-coco-transform', 'assets/players/coco_transform.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-coco-spindash', 'assets/players/coco_spindash.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('sheet-abby-transformer', 'assets/players/abby_transform.png', { frameWidth: 64, frameHeight: 64 });
        this.load.image('logo', 'assets/app_icons/friendsslay.jpg');
        this.load.image('icon-512', 'icons/icon-512.png');
        this.load.tilemapTiledJSON('world-map', 'maps/intro_one/map.json');
        this.load.image('tileset', 'maps/intro_one/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-one', 'maps/boss_intro_one/map.json');
        this.load.image('boss-tileset-one', 'maps/boss_intro_one/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-two', 'maps/boss_intro_two/map.json');
        this.load.image('boss-tileset-two', 'maps/boss_intro_two/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-three', 'maps/boss_intro_three/map.json');
        this.load.image('boss-tileset-three', 'maps/boss_intro_three/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-two', 'maps/intro_two/map.json');
        this.load.image('tileset-two', 'maps/intro_two/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-three', 'maps/intro_three/map.json');
        this.load.image('tileset-three', 'maps/intro_three/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-four', 'maps/final_one/map.json');
        this.load.image('tileset-four', 'maps/final_one/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-five', 'maps/final_two/map.json');
        this.load.image('tileset-five', 'maps/final_two/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-six', 'maps/final_three/map.json');
        this.load.image('tileset-six', 'maps/final_three/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-seven', 'maps/final_four/map.json');
        this.load.image('tileset-seven', 'maps/final_four/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-level-one', 'maps/level_one/map.json');
        this.load.image('tileset-level-one', 'maps/level_one/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-level-two', 'maps/level_two/map.json');
        this.load.image('tileset-level-two', 'maps/level_two/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-level-three', 'maps/level_three/map.json');
        this.load.image('tileset-level-three', 'maps/level_three/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-level-four', 'maps/level_four/map.json');
        this.load.image('tileset-level-four', 'maps/level_four/spritesheet.png');
        this.load.tilemapTiledJSON('world-map-level-five', 'maps/level_five/map.json');
        this.load.image('tileset-level-five', 'maps/level_five/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-final', 'maps/boss_final/map.json');
        this.load.image('boss-tileset-final', 'maps/boss_final/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-final-final', 'maps/boss_final_final/map.json');
        this.load.image('boss-tileset-final-final', 'maps/boss_final_final/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-level-one', 'maps/boss_level_one/map.json');
        this.load.image('boss-tileset-level-one', 'maps/boss_level_one/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-level-two', 'maps/boss_level_two/map.json');
        this.load.image('boss-tileset-level-two', 'maps/boss_level_two/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-level-four', 'maps/boss_level_four/map.json');
        this.load.image('boss-tileset-level-four', 'maps/boss_level_four/spritesheet.png');
        this.load.tilemapTiledJSON('boss-map-level-five', 'maps/boss_level_five/map.json');
        this.load.image('boss-tileset-level-five', 'maps/boss_level_five/spritesheet.png');
        this.load.audio('music-title', 'assets/music/title_menu.mp3');
        this.load.audio('music-gameplay', 'assets/music/gameplay_loop.mp3');
        this.load.audio('music-boss', 'assets/music/boss.mp3');
        this.load.audio('music-level4', 'assets/music/gameplay_loop1_5.mp3');
        this.load.audio('music-level5-7', 'assets/music/gameplay_loop2.mp3');
        this.load.audio('music-boss2', 'assets/music/boss2.mp3');
        this.load.audio('music-boss3', 'assets/music/boss3.mp3');
        this.load.audio('music-boss-victory', 'assets/music/boss_victory.mp3');
        this.load.audio('music-final-boss-victory', 'assets/music/game_victory.mp3');
        this.load.audio('music-end-game', 'assets/music/end_game.mp3');
        this.load.image('cutscene-celery-man-down', 'assets/players/celery_man_down.png');
        this.load.image('cutscene-victory', 'assets/players/victory.png');
        // Boss victory cutscene images — {char}_{boss}.jpg and {char}01.png in assets/players/
        const CUTSCENE_CHARS = ['abby', 'callum', 'carter', 'coco', 'conrad', 'eric', 'scarlett'];
        for (const char of CUTSCENE_CHARS) {
            // scarlett's skeleton king filename has a typo
            const skelFile = char === 'scarlett' ? `${char}_skeletong_king.jpg` : `${char}_skeleton_king.jpg`;
            this.load.image(`cutscene-${char}-skeleton_king`, `assets/players/${skelFile}`);
            this.load.image(`cutscene-${char}-zombie_king`, `assets/players/${char}_zombie_king.jpg`);
            // Generic victory pose for new boss rooms
            this.load.image(`cutscene-${char}-01`, `assets/players/${char}01.png`);
        }
    }
    create() {
        this.genCharacters();
        this.genTiles();
        this.genObjects();
        this.genScenery();
        this.genBackgrounds();
        this.genInteriorBackgrounds();
        this.setupAnimations();
        this.setupEnemyAnimations();
        this.setupEricTransformerAnimations();
        this.setupConradTruckAnimations();
        this.setupConradTransformAnimations();
        this.setupNpcAnimations();
        this.setupCarterDinoAnimations();
        this.setupCocoShadowFormAnimations();
        this.setupScarlettTRexAnimations();
        this.setupScarlettTransformAnimations();
        this.scene.start('IntroScene');
    }
    setupAnimations() {
        for (const [key, cfg] of Object.entries(SHEETS)) {
            const textureKey = `sheet-${key}`;
            if (!this.textures.exists(textureKey))
                continue; // file not found — skip
            const prefix = `char-${key}`;
            const frames = { ...ANIM_FRAMES, ...(cfg.anim ?? {}) };
            for (const [name, range] of Object.entries(frames)) {
                this.anims.create({
                    key: `${prefix}-${name}`,
                    frames: this.anims.generateFrameNumbers(textureKey, range),
                    frameRate: name === 'walk' ? 8 : name === 'shield' ? 10 : 6,
                    repeat: name === 'jump' || name === 'fall' || name === 'melee' || name === 'ability' ? 0 : -1,
                });
            }
        }
    }
    setupEnemyAnimations() {
        for (const { key, walkStart, walkEnd, walkFrames } of ENEMY_SHEETS) {
            if (!this.textures.exists(key))
                continue;
            const frames = walkFrames
                ? this.anims.generateFrameNumbers(key, { frames: walkFrames })
                : this.anims.generateFrameNumbers(key, { start: walkStart, end: walkEnd });
            const idleFrames = walkFrames
                ? this.anims.generateFrameNumbers(key, { frames: [walkFrames[0]] })
                : this.anims.generateFrameNumbers(key, { start: walkStart, end: walkStart });
            this.anims.create({ key: `${key}-walk`, frames, frameRate: 8, repeat: -1 });
            this.anims.create({ key: `${key}-idle`, frames: idleFrames, frameRate: 4, repeat: -1 });
        }
    }
    setupNpcAnimations() {
        if (!this.textures.exists('npc-duck'))
            return;
        this.anims.create({ key: 'npc-duck-idle', frames: this.anims.generateFrameNumbers('npc-duck', { start: 11, end: 13 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'npc-duck-walk', frames: this.anims.generateFrameNumbers('npc-duck', { start: 11, end: 13 }), frameRate: 8, repeat: -1 });
    }
    setupCarterDinoAnimations() {
        const ct = 'sheet-carter-transform';
        const cdj = 'sheet-carter-dino-jump';
        if (!this.textures.exists(ct) || !this.textures.exists(cdj))
            return;
        // carter_transform sheet: transform in (0-7), dino idle (7), dino walk (8-15)
        this.anims.create({ key: 'carter-transform-in', frames: this.anims.generateFrameNumbers(ct, { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'carter-transform-out', frames: this.anims.generateFrameNumbers(ct, { frames: [7, 6, 5, 4, 3, 2, 1, 0] }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'carter-dino-idle', frames: this.anims.generateFrameNumbers(ct, { frames: [7] }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'carter-dino-walk', frames: this.anims.generateFrameNumbers(ct, { start: 8, end: 15 }), frameRate: 10, repeat: -1 });
        // carter_dino_jump sheet: jump (1,3,5-9), float (8), fall (10-12)
        this.anims.create({ key: 'carter-dino-jump', frames: this.anims.generateFrameNumbers(cdj, { frames: [1, 3, 5, 6, 7, 8, 9] }), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'carter-dino-float', frames: this.anims.generateFrameNumbers(cdj, { frames: [8] }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'carter-dino-fall', frames: this.anims.generateFrameNumbers(cdj, { frames: [9] }), frameRate: 8, repeat: -1 });
    }
    setupCocoShadowFormAnimations() {
        const tf = 'sheet-coco-transform';
        const sd = 'sheet-coco-spindash';
        if (!this.textures.exists(tf) || !this.textures.exists(sd))
            return;
        // coco_transform sheet: transformation in (0-7), out (7-0), shadow idle (frame 7)
        this.anims.create({ key: 'coco-transform-in', frames: this.anims.generateFrameNumbers(tf, { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'coco-transform-out', frames: this.anims.generateFrameNumbers(tf, { frames: [7, 6, 5, 4, 3, 2, 1, 0] }), frameRate: 12, repeat: 0 });
        this.anims.create({ key: 'coco-shadow-idle', frames: this.anims.generateFrameNumbers(tf, { frames: [7] }), frameRate: 1, repeat: -1 });
        // coco_spindash sheet: locomotion
        this.anims.create({ key: 'coco-shadow-walk', frames: this.anims.generateFrameNumbers(sd, { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'coco-shadow-jump', frames: this.anims.generateFrameNumbers(sd, { frames: [7, 6, 8, 9, 10] }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'coco-shadow-fall', frames: this.anims.generateFrameNumbers(sd, { frames: [10, 9, 8, 6, 7] }), frameRate: 8, repeat: 0 });
        // coco_spindash sheet: spindash sequence
        this.anims.create({ key: 'coco-spindash-windup', frames: this.anims.generateFrameNumbers(sd, { frames: [9, 10] }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'coco-spindash-charge', frames: this.anims.generateFrameNumbers(sd, { frames: [11] }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'coco-spindash-dash', frames: this.anims.generateFrameNumbers(sd, { frames: [12] }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'coco-spindash-exit', frames: this.anims.generateFrameNumbers(sd, { start: 13, end: 15 }), frameRate: 10, repeat: 0 });
    }
    setupScarlettTransformAnimations() {
        const key = 'sheet-scarlett-transformer';
        if (!this.textures.exists(key))
            return;
        const total = this.textures.get(key).frameTotal - 1; // minus __BASE
        const fwd = Array.from({ length: total }, (_, i) => i).filter(i => i !== 8);
        const rev = [...fwd].reverse();
        this.anims.create({
            key: 'scarlett-anim-transform',
            frames: this.anims.generateFrameNumbers(key, { frames: fwd }),
            frameRate: 10, repeat: 0,
        });
        this.anims.create({
            key: 'scarlett-anim-untransform',
            frames: this.anims.generateFrameNumbers(key, { frames: rev }),
            frameRate: 10, repeat: 0,
        });
    }
    setupScarlettTRexAnimations() {
        const key = 'sheet-trex';
        if (!this.textures.exists(key))
            return;
        this.anims.create({
            key: 'trex-walk',
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: -1 }),
            frameRate: 10, repeat: -1,
        });
        this.anims.create({
            key: 'trex-idle',
            frames: this.anims.generateFrameNumbers(key, { frames: [0] }),
            frameRate: 1, repeat: -1,
        });
    }
    setupConradTruckAnimations() {
        const key = 'sheet-army-truck';
        if (!this.textures.exists(key))
            return;
        this.anims.create({
            key: 'army-truck-move',
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
            frameRate: 10, repeat: -1,
        });
        this.anims.create({
            key: 'army-truck-idle',
            frames: this.anims.generateFrameNumbers(key, { frames: [0] }),
            frameRate: 1, repeat: -1,
        });
    }
    setupConradTransformAnimations() {
        const ct = 'sheet-conrad-transform';
        if (this.textures.exists(ct)) {
            this.anims.create({ key: 'conrad-transform-in', frames: this.anims.generateFrameNumbers(ct, { start: 0, end: 6 }), frameRate: 12, repeat: 0 });
            this.anims.create({ key: 'conrad-transform-out', frames: this.anims.generateFrameNumbers(ct, { frames: [6, 5, 4, 3, 2, 1, 0] }), frameRate: 12, repeat: 0 });
            this.anims.create({ key: 'conrad-form-idle', frames: this.anims.generateFrameNumbers(ct, { frames: [14] }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'conrad-form-walk', frames: this.anims.generateFrameNumbers(ct, { frames: [15] }), frameRate: 8, repeat: -1 });
            this.anims.create({ key: 'conrad-form-air', frames: this.anims.generateFrameNumbers(ct, { frames: [15] }), frameRate: 1, repeat: -1 });
        }
        for (const [type, key] of [['truck', 'sheet-white-truck'], ['tank', 'sheet-white-tank']]) {
            if (!this.textures.exists(key))
                continue;
            this.anims.create({ key: `white-${type}-move`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: `white-${type}-idle`, frames: this.anims.generateFrameNumbers(key, { frames: [0] }), frameRate: 1, repeat: -1 });
        }
        const hk = 'sheet-white-heli';
        if (this.textures.exists(hk)) {
            this.anims.create({ key: 'white-heli-move', frames: this.anims.generateFrameNumbers(hk, { start: 8, end: 11 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'white-heli-idle', frames: this.anims.generateFrameNumbers(hk, { frames: [0] }), frameRate: 1, repeat: -1 });
        }
    }
    setupEricTransformerAnimations() {
        const key = 'sheet-eric-transformer';
        if (!this.textures.exists(key))
            return;
        // frames 0-9 (skip 10 & 11) — transform into truck
        this.anims.create({
            key: 'eric-anim-transform',
            frames: this.anims.generateFrameNumbers(key, { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }),
            frameRate: 10, repeat: 0,
        });
        // frames 9-0 in reverse — transform back into Eric
        this.anims.create({
            key: 'eric-anim-untransform',
            frames: this.anims.generateFrameNumbers(key, { frames: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] }),
            frameRate: 10, repeat: 0,
        });
        // frames 12-15 — truck driving loop
        this.anims.create({
            key: 'eric-anim-truck-move',
            frames: this.anims.generateFrameNumbers(key, { start: 12, end: 15 }),
            frameRate: 10, repeat: -1,
        });
        // single frame — truck idle
        this.anims.create({
            key: 'eric-anim-truck-idle',
            frames: this.anims.generateFrameNumbers(key, { frames: [12] }),
            frameRate: 1, repeat: -1,
        });
    }
    // Expose config for Player to read
    static getSheetKey(playerId) {
        const slot = PLAYER_SHEETS[playerId];
        return slot ? `sheet-${slot}` : null;
    }
    static getAnimPrefix(playerId) {
        const slot = PLAYER_SHEETS[playerId];
        return slot ? `char-${slot}` : null;
    }
    // Fallback texture when no sprite sheet is available
    static getFallbackTexture(playerId) {
        return ['player', 'player-2', 'player-2', 'player-3'][playerId] ?? 'player';
    }
    static getSelectableCharacters() {
        return Object.entries(SHEETS)
            .filter(([, cfg]) => cfg.selectable)
            .map(([key, cfg]) => ({
            key,
            name: cfg.name ?? key.toUpperCase(),
            sheetKey: `sheet-${key}`,
            animPrefix: `char-${key}`,
            previewFrame: cfg.previewFrame ?? 0,
        }));
    }
    // ── characters ──────────────────────────────────────────────────────────────
    genCharacters() {
        // Player 1 — pink Kirby-ish
        const p1 = this.g();
        p1.fillStyle(0xff9eb5);
        p1.fillCircle(16, 17, 14); // body
        p1.fillStyle(0xff6b9d, 0.7);
        p1.fillCircle(9, 20, 5); // blush L
        p1.fillStyle(0xff6b9d, 0.7);
        p1.fillCircle(23, 20, 5); // blush R
        p1.fillStyle(0x001f54);
        p1.fillEllipse(10, 14, 7, 9); // eye L
        p1.fillStyle(0x001f54);
        p1.fillEllipse(22, 14, 7, 9); // eye R
        p1.fillStyle(0xffffff);
        p1.fillCircle(8, 12, 2); // shine L
        p1.fillStyle(0xffffff);
        p1.fillCircle(20, 12, 2); // shine R
        p1.fillStyle(0x8b0000);
        p1.fillEllipse(16, 22, 8, 5); // mouth
        p1.fillStyle(0xffa0c0);
        p1.fillEllipse(16, 6, 10, 6); // top highlight
        p1.generateTexture('player', 32, 32);
        p1.destroy();
        // Player 2 — blue variant
        const p2 = this.g();
        p2.fillStyle(0x82b4ff);
        p2.fillCircle(16, 17, 14);
        p2.fillStyle(0x5090ee, 0.7);
        p2.fillCircle(9, 20, 5);
        p2.fillStyle(0x5090ee, 0.7);
        p2.fillCircle(23, 20, 5);
        p2.fillStyle(0x001f54);
        p2.fillEllipse(10, 14, 7, 9);
        p2.fillStyle(0x001f54);
        p2.fillEllipse(22, 14, 7, 9);
        p2.fillStyle(0xffffff);
        p2.fillCircle(8, 12, 2);
        p2.fillStyle(0xffffff);
        p2.fillCircle(20, 12, 2);
        p2.fillStyle(0x8b0000);
        p2.fillEllipse(16, 22, 8, 5);
        p2.fillStyle(0xa0c8ff);
        p2.fillEllipse(16, 6, 10, 6);
        p2.generateTexture('player-2', 32, 32);
        p2.destroy();
        // Enemy — purple blob (None ability)
        const en = this.g();
        en.fillStyle(0x7b1fa2);
        en.fillEllipse(14, 16, 26, 24);
        en.fillStyle(0xab47bc);
        en.fillEllipse(14, 11, 18, 12);
        en.fillStyle(0xffffff);
        en.fillEllipse(8, 12, 8, 10);
        en.fillEllipse(20, 12, 8, 10);
        en.fillStyle(0x1a0033);
        en.fillCircle(8, 13, 3);
        en.fillCircle(20, 13, 3);
        en.fillStyle(0xffffff);
        en.fillCircle(7, 11, 1.5);
        en.fillCircle(19, 11, 1.5);
        en.fillStyle(0xce93d8, 0.5);
        en.fillEllipse(14, 6, 12, 6);
        en.generateTexture('enemy', 28, 28);
        en.destroy();
        // Dragon (Fire ability) — 44×44
        const dr = this.g();
        // Wings (behind body)
        dr.fillStyle(0x7f0000, 0.85);
        dr.fillTriangle(0, 16, 10, 28, 0, 40);
        dr.fillTriangle(44, 16, 34, 28, 44, 40);
        dr.lineStyle(1, 0x550000, 0.6);
        dr.lineBetween(0, 16, 10, 28);
        dr.lineBetween(10, 28, 0, 40);
        dr.lineBetween(44, 16, 34, 28);
        dr.lineBetween(34, 28, 44, 40);
        // Horns
        dr.fillStyle(0x8d4000);
        dr.fillTriangle(14, 8, 12, 0, 20, 8);
        dr.fillTriangle(30, 8, 32, 0, 24, 8);
        // Head
        dr.fillStyle(0xb71c1c);
        dr.fillEllipse(22, 14, 24, 18);
        dr.fillStyle(0xd32f2f);
        dr.fillEllipse(22, 12, 18, 12);
        // Snout
        dr.fillStyle(0xc62828);
        dr.fillRect(15, 17, 14, 8);
        dr.fillStyle(0x7f0000);
        dr.fillRect(17, 20, 3, 2);
        dr.fillRect(24, 20, 3, 2);
        // Eyes (slit pupils)
        dr.fillStyle(0xffee00);
        dr.fillEllipse(15, 11, 9, 7);
        dr.fillEllipse(29, 11, 9, 7);
        dr.fillStyle(0x0d0000);
        dr.fillRect(15, 8, 2, 7);
        dr.fillRect(29, 8, 2, 7);
        dr.fillStyle(0xffffff, 0.6);
        dr.fillRect(13, 9, 2, 2);
        dr.fillRect(27, 9, 2, 2);
        // Teeth
        dr.fillStyle(0xfff3e0);
        dr.fillTriangle(17, 24, 19, 29, 21, 24);
        dr.fillTriangle(21, 24, 23, 29, 25, 24);
        dr.fillTriangle(25, 24, 27, 29, 29, 24);
        // Body with scales
        dr.fillStyle(0xb71c1c);
        dr.fillEllipse(22, 34, 26, 20);
        dr.fillStyle(0xd32f2f);
        dr.fillEllipse(22, 30, 18, 14);
        // Scale rows
        dr.fillStyle(0x7f0000, 0.55);
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                dr.fillEllipse(12 + col * 8, 28 + row * 6, 7, 4);
            }
        }
        // Claws
        dr.fillStyle(0xf0c080);
        dr.fillTriangle(15, 44, 17, 40, 19, 44);
        dr.fillTriangle(20, 44, 22, 40, 24, 44);
        dr.fillTriangle(25, 44, 27, 40, 29, 44);
        dr.generateTexture('enemy-dragon', 44, 44);
        dr.destroy();
        // Alien (Bomb ability) — 40×44
        const al = this.g();
        // Huge dome head
        al.fillStyle(0x2d4a1e);
        al.fillEllipse(20, 14, 36, 30);
        al.fillStyle(0x3d6b2a);
        al.fillEllipse(20, 10, 28, 22);
        al.fillStyle(0x4a7f35, 0.5);
        al.fillEllipse(14, 8, 14, 8); // head sheen
        // Antenna
        al.fillStyle(0x2d4a1e);
        al.fillRect(19, 0, 3, 10);
        al.fillStyle(0xff5722);
        al.fillCircle(20, 0, 4); // glowing tip
        al.fillStyle(0xff8a65);
        al.fillCircle(20, 0, 2);
        // Three glowing eyes in a row
        al.fillStyle(0xff1744);
        al.fillCircle(12, 14, 5);
        al.fillStyle(0xff1744);
        al.fillCircle(20, 14, 5);
        al.fillStyle(0xff1744);
        al.fillCircle(28, 14, 5);
        al.fillStyle(0xff6d00);
        al.fillCircle(12, 14, 3);
        al.fillCircle(20, 14, 3);
        al.fillCircle(28, 14, 3);
        al.fillStyle(0xffffff, 0.7);
        al.fillCircle(11, 13, 1.5);
        al.fillCircle(19, 13, 1.5);
        al.fillCircle(27, 13, 1.5);
        // Slit mouth
        al.fillStyle(0x1a330d);
        al.fillRect(14, 22, 12, 3);
        al.fillStyle(0x4a7f35);
        al.fillRect(15, 23, 2, 2);
        al.fillRect(19, 23, 2, 2);
        al.fillRect(23, 23, 2, 2);
        // Thin body / torso
        al.fillStyle(0x2d4a1e);
        al.fillEllipse(20, 34, 14, 16);
        al.fillStyle(0x3d6b2a);
        al.fillEllipse(20, 31, 10, 10);
        // Long spindly arms
        al.fillStyle(0x2d4a1e);
        al.fillRect(4, 26, 5, 14);
        al.fillRect(31, 26, 5, 14); // upper arms
        al.fillRect(2, 38, 6, 4);
        al.fillRect(32, 38, 6, 4); // lower arms
        // 3-fingered hands
        al.fillStyle(0x3d6b2a);
        al.fillTriangle(2, 42, 4, 44, 6, 42);
        al.fillTriangle(4, 42, 6, 44, 8, 42);
        al.fillTriangle(32, 42, 34, 44, 36, 42);
        al.fillTriangle(34, 42, 36, 44, 38, 42);
        al.generateTexture('enemy-alien', 40, 44);
        al.destroy();
        // Cyberbot (Lightning ability) — 40×44
        const cb = this.g();
        // Shoulder pauldrons
        cb.fillStyle(0x546e7a);
        cb.fillRect(2, 18, 12, 8);
        cb.fillRect(26, 18, 12, 8);
        cb.fillStyle(0x78909c);
        cb.fillRect(3, 19, 10, 4);
        cb.fillRect(27, 19, 10, 4);
        // Head / helmet
        cb.fillStyle(0x455a64);
        cb.fillRect(8, 4, 24, 18);
        cb.fillStyle(0x546e7a);
        cb.fillRect(9, 5, 22, 14); // face panel
        cb.fillStyle(0x37474f);
        cb.fillRect(8, 4, 24, 3); // top ridge
        // Visor strip (glowing yellow)
        cb.fillStyle(0x1a1a00);
        cb.fillRect(10, 10, 20, 7);
        cb.fillStyle(0xffea00);
        cb.fillRect(11, 11, 18, 5); // visor glow
        cb.fillStyle(0xffffff, 0.5);
        cb.fillRect(12, 11, 6, 2); // visor sheen
        // Side lights
        cb.fillStyle(0x00e5ff);
        cb.fillRect(8, 12, 2, 3);
        cb.fillRect(30, 12, 2, 3);
        // Antenna
        cb.fillStyle(0x78909c);
        cb.fillRect(17, 0, 3, 6);
        cb.fillStyle(0x00e5ff);
        cb.fillCircle(18, 0, 3);
        // Body / chassis
        cb.fillStyle(0x37474f);
        cb.fillRect(10, 22, 20, 18);
        cb.fillStyle(0x455a64);
        cb.fillRect(11, 23, 18, 14);
        // Panel lines on body
        cb.lineStyle(1, 0x263238);
        cb.lineBetween(11, 28, 29, 28);
        cb.lineStyle(1, 0x263238);
        cb.lineBetween(20, 23, 20, 37);
        // Energy core
        cb.fillStyle(0x00e5ff, 0.9);
        cb.fillCircle(20, 30, 5);
        cb.fillStyle(0xffffff, 0.7);
        cb.fillCircle(20, 30, 2);
        // Arms
        cb.fillStyle(0x37474f);
        cb.fillRect(2, 22, 8, 16);
        cb.fillRect(30, 22, 8, 16);
        cb.fillStyle(0x455a64);
        cb.fillRect(3, 23, 6, 12);
        cb.fillRect(31, 23, 6, 12);
        // Clamp hands
        cb.fillStyle(0x263238);
        cb.fillRect(0, 36, 10, 6);
        cb.fillRect(30, 36, 10, 6);
        cb.fillStyle(0x455a64);
        cb.fillRect(1, 37, 4, 4);
        cb.fillRect(35, 37, 4, 4);
        // Legs
        cb.fillStyle(0x37474f);
        cb.fillRect(12, 40, 7, 4);
        cb.fillRect(21, 40, 7, 4);
        cb.fillStyle(0x455a64);
        cb.fillRect(11, 42, 9, 3);
        cb.fillRect(20, 42, 9, 3);
        cb.generateTexture('enemy-bot', 40, 44);
        cb.destroy();
        // Frost Wraith (Ice ability) — 38×48
        const fw = this.g();
        // Wispy tail / body base (tapered ghost shape)
        fw.fillStyle(0x1a237e, 0.6);
        fw.fillEllipse(19, 36, 22, 28);
        fw.fillStyle(0x1565c0, 0.7);
        fw.fillEllipse(19, 28, 26, 32);
        fw.fillStyle(0x42a5f5, 0.55);
        fw.fillEllipse(19, 22, 28, 28);
        fw.fillStyle(0x90caf9, 0.4);
        fw.fillEllipse(19, 16, 24, 22);
        // Crystal spikes on body
        fw.fillStyle(0xbbdefb, 0.8);
        fw.fillTriangle(6, 32, 2, 24, 10, 26); // left spike
        fw.fillTriangle(32, 32, 38, 24, 30, 26); // right spike
        fw.fillTriangle(10, 38, 5, 30, 14, 34); // lower-left spike
        fw.fillTriangle(28, 38, 33, 30, 24, 34); // lower-right spike
        // Head region
        fw.fillStyle(0x1976d2, 0.8);
        fw.fillEllipse(19, 12, 28, 24);
        fw.fillStyle(0x64b5f6, 0.5);
        fw.fillEllipse(16, 9, 14, 10); // head sheen
        // Hollow eye sockets
        fw.fillStyle(0x000a1a);
        fw.fillEllipse(13, 10, 10, 10);
        fw.fillEllipse(25, 10, 10, 10);
        fw.fillStyle(0x82b1ff, 0.9);
        fw.fillEllipse(13, 10, 6, 6);
        fw.fillEllipse(25, 10, 6, 6);
        fw.fillStyle(0xe3f2fd);
        fw.fillEllipse(13, 10, 3, 3);
        fw.fillEllipse(25, 10, 3, 3);
        // Rictus grin (jagged ice teeth)
        fw.fillStyle(0x000a1a);
        fw.fillRect(12, 19, 14, 4);
        fw.fillStyle(0xe3f2fd);
        fw.fillTriangle(13, 19, 15, 23, 17, 19);
        fw.fillTriangle(17, 19, 19, 23, 21, 19);
        fw.fillTriangle(21, 19, 23, 23, 25, 19);
        // Crown of ice spikes on head
        fw.fillStyle(0xbbdefb);
        for (let i = 0; i < 5; i++) {
            const sx = 8 + i * 6;
            fw.fillTriangle(sx, 4, sx + 3, -2, sx + 6, 4);
        }
        // Faint glow aura
        fw.lineStyle(3, 0x90caf9, 0.25);
        fw.strokeEllipse(19, 20, 34, 42);
        fw.generateTexture('enemy-wraith', 38, 48);
        fw.destroy();
        // Player 3 fallback (orange — if no 4th sprite sheet)
        const p3 = this.g();
        p3.fillStyle(0xff8c00);
        p3.fillCircle(16, 17, 14);
        p3.fillStyle(0xff6d00, 0.7);
        p3.fillCircle(9, 20, 5);
        p3.fillCircle(23, 20, 5);
        p3.fillStyle(0x001f54);
        p3.fillEllipse(10, 14, 7, 9);
        p3.fillEllipse(22, 14, 7, 9);
        p3.fillStyle(0xffffff);
        p3.fillCircle(8, 12, 2);
        p3.fillCircle(20, 12, 2);
        p3.fillStyle(0x8b0000);
        p3.fillEllipse(16, 22, 8, 5);
        p3.fillStyle(0xffcc80);
        p3.fillEllipse(16, 6, 10, 6);
        p3.generateTexture('player-3', 32, 32);
        p3.destroy();
    }
    // ── tiles ───────────────────────────────────────────────────────────────────
    genTiles() {
        // Metal — space station (level 1)
        const m = this.g();
        m.fillStyle(0x37474f);
        m.fillRect(0, 0, 32, 32);
        m.fillStyle(0x546e7a);
        m.fillRect(0, 0, 32, 4); // top edge highlight
        m.fillStyle(0x263238);
        m.fillRect(0, 28, 32, 4); // bottom shadow
        m.fillStyle(0x455a64);
        m.fillRect(4, 8, 24, 2); // rivet row 1
        m.fillStyle(0x455a64);
        m.fillRect(4, 18, 24, 2); // rivet row 2
        m.fillStyle(0x607d8b);
        m.fillRect(6, 9, 4, 4); // rivet bolt
        m.fillStyle(0x607d8b);
        m.fillRect(22, 9, 4, 4);
        m.fillStyle(0x607d8b);
        m.fillRect(6, 19, 4, 4);
        m.fillStyle(0x607d8b);
        m.fillRect(22, 19, 4, 4);
        m.generateTexture('tile-metal', 32, 32);
        m.destroy();
        // Rock — asteroid (level 2)
        const r = this.g();
        r.fillStyle(0x4e342e);
        r.fillRect(0, 0, 32, 32);
        r.fillStyle(0x6d4c41);
        r.fillRect(0, 0, 32, 4);
        r.fillStyle(0x3e2723);
        r.fillRect(0, 28, 32, 4);
        r.fillStyle(0x5d4037);
        r.fillRect(3, 6, 8, 8);
        r.fillStyle(0x5d4037);
        r.fillRect(18, 14, 10, 6);
        r.fillStyle(0x3e2723);
        r.fillRect(3, 7, 4, 4);
        r.fillStyle(0x3e2723);
        r.fillRect(20, 15, 5, 3);
        r.generateTexture('tile-rock', 32, 32);
        r.destroy();
        // Core — planet core / lava (level 3)
        const c = this.g();
        c.fillStyle(0x7f0000);
        c.fillRect(0, 0, 32, 32);
        c.fillStyle(0xc62828);
        c.fillRect(0, 0, 32, 4);
        c.fillStyle(0x4a0000);
        c.fillRect(0, 28, 32, 4);
        c.fillStyle(0xff5722);
        c.fillRect(4, 8, 6, 3); // lava crack 1
        c.fillStyle(0xff5722);
        c.fillRect(16, 16, 10, 3); // lava crack 2
        c.fillStyle(0xff8a65);
        c.fillRect(5, 9, 2, 1); // glow
        c.fillStyle(0xff8a65);
        c.fillRect(18, 17, 3, 1);
        c.generateTexture('tile-core', 32, 32);
        c.destroy();
        // Destructible block
        const d = this.g();
        d.fillStyle(0x78909c);
        d.fillRect(0, 0, 32, 32);
        d.fillStyle(0x90a4ae);
        d.fillRect(0, 0, 32, 3);
        d.fillStyle(0x546e7a);
        d.fillRect(0, 29, 32, 3);
        d.lineStyle(2, 0x546e7a);
        d.strokeRect(2, 2, 28, 28);
        d.fillStyle(0x607d8b);
        d.fillRect(4, 4, 10, 10);
        d.fillStyle(0x607d8b);
        d.fillRect(18, 18, 10, 10);
        d.generateTexture('destructible', 32, 32);
        d.destroy();
        // Castle stone — cosmic purple brickwork
        const s = this.g();
        s.fillStyle(0x35304e, 1);
        s.fillRect(0, 0, 32, 32);
        s.fillStyle(0x473f62, 1);
        s.fillRect(1, 1, 14, 14); // top-left brick
        s.fillStyle(0x2e2944, 1);
        s.fillRect(17, 1, 14, 14); // top-right brick
        s.fillStyle(0x2e2944, 1);
        s.fillRect(1, 17, 14, 14); // bot-left brick
        s.fillStyle(0x473f62, 1);
        s.fillRect(17, 17, 14, 14); // bot-right brick
        s.fillStyle(0x1c1832, 1);
        s.fillRect(0, 15, 32, 2); // horizontal mortar
        s.fillStyle(0x1c1832, 1);
        s.fillRect(15, 0, 2, 15); // vertical mortar top
        s.fillStyle(0x1c1832, 1);
        s.fillRect(15, 17, 2, 15); // vertical mortar bot
        s.fillStyle(0x9966ff, 0.30);
        s.fillRect(1, 1, 12, 2); // cosmic highlight L
        s.fillStyle(0x9966ff, 0.30);
        s.fillRect(17, 17, 12, 2); // cosmic highlight R
        s.generateTexture('tile-castle', 32, 32);
        s.destroy();
    }
    // ── game objects ─────────────────────────────────────────────────────────────
    genObjects() {
        // Crate
        const cr = this.g();
        cr.fillStyle(0x8d6e63);
        cr.fillRect(0, 0, 32, 32);
        cr.fillStyle(0x5d4037);
        cr.fillRect(0, 0, 32, 3);
        cr.fillStyle(0x5d4037);
        cr.fillRect(0, 29, 32, 3);
        cr.fillStyle(0x5d4037);
        cr.fillRect(0, 0, 3, 32);
        cr.fillStyle(0x5d4037);
        cr.fillRect(29, 0, 3, 32);
        cr.fillStyle(0x6d4c41);
        cr.fillRect(14, 0, 4, 32); // plank
        cr.fillStyle(0x6d4c41);
        cr.fillRect(0, 14, 32, 4); // plank
        cr.fillStyle(0xa1887f);
        cr.fillRect(4, 4, 8, 8);
        cr.fillStyle(0xa1887f);
        cr.fillRect(20, 4, 8, 8);
        cr.fillStyle(0xa1887f);
        cr.fillRect(4, 20, 8, 8);
        cr.fillStyle(0xa1887f);
        cr.fillRect(20, 20, 8, 8);
        cr.generateTexture('crate', 32, 32);
        cr.destroy();
        // Warp star (kept for ability-drop orbs)
        const ws = this.g();
        ws.fillStyle(0xffd600);
        ws.fillPoints(this.starPts(24, 24, 22, 9, 5), true);
        ws.fillStyle(0xfff9c4);
        ws.fillPoints(this.starPts(24, 24, 10, 4, 5), true);
        ws.lineStyle(2, 0xffab00);
        ws.strokePoints(this.starPts(24, 24, 22, 9, 5), true);
        ws.generateTexture('warp-star', 48, 48);
        ws.destroy();
        // Space portal — level exit goal
        const gp = this.g();
        const pcx = 28, pcy = 28;
        gp.fillStyle(0x000a1a);
        gp.fillCircle(pcx, pcy, 26); // void interior
        gp.lineStyle(8, 0x004d7a, 0.3);
        gp.strokeCircle(pcx, pcy, 26); // outer soft halo
        gp.lineStyle(4, 0x00e5ff, 0.95);
        gp.strokeCircle(pcx, pcy, 24); // bright outer ring
        gp.lineStyle(3, 0x40c4ff, 0.75);
        gp.strokeCircle(pcx, pcy, 18); // mid ring
        gp.lineStyle(2, 0x80d8ff, 0.55);
        gp.strokeCircle(pcx, pcy, 12); // inner ring
        gp.lineStyle(1, 0xe1f5fe, 0.45);
        gp.strokeCircle(pcx, pcy, 6); // center ring
        // Radial vortex spokes — rotationally symmetric so spin looks good
        for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            gp.lineStyle(1, 0x40c4ff, 0.35);
            gp.lineBetween(pcx + Math.cos(ang) * 8, pcy + Math.sin(ang) * 8, pcx + Math.cos(ang) * 22, pcy + Math.sin(ang) * 22);
        }
        gp.fillStyle(0x80d8ff, 0.85);
        gp.fillCircle(pcx, pcy, 4); // center energy dot
        gp.fillStyle(0xffffff, 0.7);
        gp.fillCircle(pcx, pcy, 2); // bright core
        gp.generateTexture('goal-portal', 56, 56);
        gp.destroy();
        // Star projectile (Kirby spit star)
        const sp = this.g();
        sp.fillStyle(0xffeb3b);
        sp.fillPoints(this.starPts(10, 10, 9, 4, 5), true);
        sp.fillStyle(0xffffff);
        sp.fillPoints(this.starPts(10, 10, 4, 2, 5), true);
        sp.generateTexture('star-spit', 20, 20);
        sp.destroy();
        // Fireball
        const fb = this.g();
        fb.fillStyle(0xff6f00);
        fb.fillCircle(8, 8, 7);
        fb.fillStyle(0xffcc02);
        fb.fillCircle(8, 9, 4);
        fb.fillStyle(0xffffff);
        fb.fillCircle(7, 8, 2);
        fb.generateTexture('fireball', 16, 16);
        fb.destroy();
        // Fragment / debris
        const fr = this.g();
        fr.fillStyle(0x78909c);
        fr.fillRect(0, 0, 12, 12);
        fr.fillStyle(0x546e7a);
        fr.fillRect(0, 0, 12, 3);
        fr.fillStyle(0x90a4ae);
        fr.fillRect(2, 2, 4, 4);
        fr.generateTexture('fragment', 12, 12);
        fr.destroy();
        // Small planet / decorations
        this.genPlanet('planet-earth', 48, 0x1a5276, 0x27ae60, 0x85c1e9);
        this.genPlanet('planet-purple', 36, 0x4a148c, 0x7b1fa2, 0xce93d8);
        this.genPlanet('planet-red', 56, 0x7f0000, 0xb71c1c, 0xff5722);
    }
    // ── scenery props ─────────────────────────────────────────────────────────────
    genScenery() {
        this.genLevel1Scenery();
        this.genLevel2Scenery();
        this.genLevel3Scenery();
        this.genStationRoomProps();
        this.genCollectibles();
    }
    // ── station room props (used by the 5 scenery variants) ──────────────────────
    genStationRoomProps() {
        // Galaxy viewscreen — wall-mounted monitor (240×130)
        const vs = this.g();
        vs.fillStyle(0x1a2a40);
        vs.fillRect(0, 0, 240, 130);
        vs.fillStyle(0x263d58);
        vs.fillRect(0, 0, 240, 6);
        vs.fillStyle(0x0d1a2a);
        vs.fillRect(6, 6, 228, 118);
        vs.fillStyle(0x000814);
        vs.fillRect(10, 10, 220, 110);
        vs.fillStyle(0x0a1428, 0.8);
        vs.fillRect(10, 10, 220, 110);
        // Stars
        for (const [sx, sy] of [[24, 22], [68, 18], [105, 35], [148, 15], [180, 42], [210, 24], [35, 75], [90, 82], [130, 60], [175, 90], [220, 55], [55, 50], [160, 70]]) {
            vs.fillStyle(0xffffff, 0.9);
            vs.fillRect(sx, sy, 2, 2);
        }
        // Galaxy core spiral
        vs.fillStyle(0x102040, 0.55);
        vs.fillEllipse(115, 60, 90, 44);
        vs.fillStyle(0x1a3868, 0.5);
        vs.fillEllipse(115, 60, 54, 26);
        vs.fillStyle(0x2244aa, 0.4);
        vs.fillEllipse(115, 60, 30, 14);
        vs.fillStyle(0x5577ff, 0.35);
        vs.fillCircle(115, 60, 8);
        vs.fillStyle(0xffffff, 0.85);
        vs.fillRect(114, 59, 3, 3);
        // Scan lines
        for (let ly = 12; ly < 116; ly += 4) {
            vs.fillStyle(0x000000, 0.1);
            vs.fillRect(10, ly, 220, 2);
        }
        // Frame LED row
        vs.fillStyle(0x2a3e58);
        vs.fillRect(0, 124, 240, 6);
        for (let i = 0; i < 7; i++) {
            vs.fillStyle([0x00ee44, 0xffcc00, 0x00aaff, 0x00ee44, 0xff4400, 0x00aaff, 0xffcc00][i]);
            vs.fillRect(14 + i * 18, 126, 8, 3);
        }
        vs.generateTexture('scn-viewscreen', 240, 130);
        vs.destroy();
        // Horizontal pipe bundle — ceiling pipes (200×24)
        const pb = this.g();
        pb.fillStyle(0x1a2438);
        pb.fillRect(0, 0, 200, 24);
        for (const [py, c1, c2] of [[2, 0x546e7a, 0x78909c], [10, 0x455a64, 0x607d8b], [18, 0x37474f, 0x546e7a]]) {
            pb.fillStyle(c1);
            pb.fillRect(0, py, 200, 6);
            pb.fillStyle(c2);
            pb.fillRect(0, py, 200, 2);
            pb.fillStyle(0x1a2a36);
            pb.fillRect(0, py + 5, 200, 1);
        }
        for (let fx = 18; fx < 200; fx += 48) {
            pb.fillStyle(0x4a607a);
            pb.fillRect(fx, 0, 12, 24);
            pb.fillStyle(0x5c7490);
            pb.fillRect(fx + 1, 1, 10, 5);
            pb.fillStyle(0x2a3848);
            pb.fillRect(fx + 1, 18, 10, 5);
        }
        pb.generateTexture('scn-pipe-bundle', 200, 24);
        pb.destroy();
        // Fuel cylinder — vertical tank (40×88)
        const fc = this.g();
        fc.fillStyle(0x455a64);
        fc.fillRect(6, 8, 28, 72);
        fc.fillStyle(0x546e7a);
        fc.fillRect(6, 8, 28, 5);
        fc.fillStyle(0x263238);
        fc.fillRect(6, 75, 28, 5);
        fc.fillStyle(0x37474f);
        fc.fillRect(3, 16, 34, 5);
        fc.fillStyle(0x37474f);
        fc.fillRect(3, 66, 34, 5);
        fc.fillStyle(0x607d8b);
        fc.fillRect(7, 10, 4, 70);
        fc.fillStyle(0xffd600, 0.85);
        fc.fillRect(14, 36, 12, 16);
        fc.fillStyle(0x111111);
        fc.fillRect(14, 36, 12, 4);
        fc.fillRect(14, 48, 12, 4);
        fc.fillStyle(0x37474f);
        fc.fillCircle(32, 34, 6);
        fc.fillStyle(0x1a2a36);
        fc.fillCircle(32, 34, 4);
        fc.fillStyle(0xff1744);
        fc.fillRect(33, 31, 2, 5);
        fc.fillStyle(0x263238);
        fc.fillRect(0, 80, 40, 8);
        fc.fillStyle(0x37474f);
        fc.fillRect(4, 80, 32, 4);
        fc.generateTexture('scn-fuel-cylinder', 40, 88);
        fc.destroy();
        // Storage pod — cargo container (60×70)
        const sp = this.g();
        sp.fillStyle(0x37474f);
        sp.fillRect(0, 0, 60, 70);
        sp.fillStyle(0x546e7a);
        sp.fillRect(0, 0, 60, 5);
        sp.fillStyle(0x263238);
        sp.fillRect(0, 65, 60, 5);
        sp.fillStyle(0x455a64);
        sp.fillRect(0, 0, 5, 70);
        sp.fillRect(55, 0, 5, 70);
        sp.fillStyle(0x263238);
        sp.fillRect(0, 34, 60, 2);
        sp.fillStyle(0xffd600, 0.9);
        sp.fillRect(8, 8, 44, 12);
        sp.fillStyle(0x1a1a1a);
        sp.fillRect(10, 10, 40, 8);
        sp.fillStyle(0xffd600);
        sp.fillRect(8, 44, 44, 16);
        sp.fillStyle(0x111111);
        sp.fillRect(8, 44, 44, 4);
        sp.fillRect(8, 56, 44, 4);
        sp.fillStyle(0x607d8b);
        sp.fillRect(24, 50, 12, 6);
        sp.fillStyle(0x37474f);
        sp.fillRect(26, 52, 8, 2);
        sp.generateTexture('scn-storage-pod', 60, 70);
        sp.destroy();
        // Specimen tank — tall glowing cylinder (34×100)
        const st2 = this.g();
        st2.fillStyle(0x37474f);
        st2.fillRect(0, 0, 34, 8);
        st2.fillStyle(0x546e7a);
        st2.fillRect(0, 0, 34, 3);
        st2.fillStyle(0x1a3040);
        st2.fillRect(4, 8, 26, 84);
        st2.fillStyle(0x000e18);
        st2.fillRect(6, 10, 22, 80);
        st2.fillStyle(0x003344, 0.85);
        st2.fillRect(6, 10, 22, 80);
        st2.fillStyle(0x005566, 0.5);
        st2.fillRect(7, 12, 18, 72);
        st2.fillStyle(0x00aabb, 0.22);
        st2.fillRect(8, 14, 8, 68);
        st2.fillStyle(0x003344, 0.6);
        st2.fillEllipse(17, 56, 14, 20);
        st2.fillStyle(0x37474f);
        st2.fillRect(0, 92, 34, 8);
        st2.fillStyle(0x263238);
        st2.fillRect(0, 96, 34, 4);
        st2.fillStyle(0x455a64);
        st2.fillRect(28, 14, 6, 8);
        st2.fillRect(28, 76, 6, 8);
        st2.generateTexture('scn-specimen-tank', 34, 100);
        st2.destroy();
        // Weapon locker — wall rack (64×80)
        const wl = this.g();
        wl.fillStyle(0x263238);
        wl.fillRect(0, 0, 64, 80);
        wl.fillStyle(0x37474f);
        wl.fillRect(3, 3, 58, 74);
        wl.fillStyle(0x1a2226);
        wl.fillRect(8, 8, 20, 64);
        wl.fillRect(36, 8, 20, 64);
        wl.fillStyle(0x455a64);
        wl.fillRect(13, 18, 10, 38);
        wl.fillRect(14, 40, 8, 8);
        wl.fillStyle(0x546e7a);
        wl.fillRect(14, 42, 6, 4);
        wl.fillStyle(0x455a64);
        wl.fillRect(41, 18, 10, 38);
        wl.fillRect(42, 40, 8, 8);
        wl.fillStyle(0x546e7a);
        wl.fillRect(42, 42, 6, 4);
        wl.fillStyle(0x00ee44);
        wl.fillRect(8, 4, 4, 3);
        wl.fillRect(36, 4, 4, 3);
        wl.fillStyle(0xff1744);
        wl.fillRect(52, 4, 4, 3);
        wl.fillStyle(0x78909c);
        wl.fillRect(28, 35, 8, 10);
        wl.fillStyle(0x546e7a);
        wl.fillRect(29, 36, 6, 5);
        wl.fillStyle(0x263238);
        wl.fillCircle(32, 39, 2);
        wl.generateTexture('scn-weapon-locker', 64, 80);
        wl.destroy();
        // Console unit — floor terminal (72×52)
        const cu = this.g();
        cu.fillStyle(0x1e2d42);
        cu.fillRect(0, 0, 72, 52);
        cu.fillStyle(0x37474f);
        cu.fillRect(0, 0, 72, 4);
        cu.fillStyle(0x152030);
        cu.fillRect(4, 8, 64, 30);
        cu.fillStyle(0x001833);
        cu.fillRect(6, 10, 60, 26);
        cu.fillStyle(0x00aa44, 0.65);
        cu.fillRect(10, 14, 30, 2);
        cu.fillStyle(0x00aa44, 0.5);
        cu.fillRect(10, 18, 48, 2);
        cu.fillStyle(0x00aa44, 0.45);
        cu.fillRect(10, 22, 22, 2);
        cu.fillStyle(0x0055cc, 0.7);
        cu.fillRect(10, 26, 42, 6);
        cu.fillStyle(0x263a52);
        cu.fillRect(4, 40, 64, 8);
        for (let bi = 0; bi < 8; bi++) {
            cu.fillStyle([0x00cc44, 0x00cc44, 0x00cc44, 0xffcc00, 0xffcc00, 0x4499ff, 0x4499ff, 0xff4400][bi]);
            cu.fillRect(6 + bi * 8, 41, 6, 6);
        }
        cu.fillStyle(0x263238);
        cu.fillRect(8, 48, 16, 4);
        cu.fillRect(48, 48, 16, 4);
        cu.generateTexture('scn-console-unit', 72, 52);
        cu.destroy();
        // Security camera — wall mount (32×22)
        const sc = this.g();
        sc.fillStyle(0x263238);
        sc.fillRect(12, 0, 8, 8);
        sc.fillStyle(0x37474f);
        sc.fillRect(8, 6, 16, 12);
        sc.fillStyle(0x1a2226);
        sc.fillRect(10, 8, 12, 8);
        sc.fillStyle(0x000000);
        sc.fillCircle(16, 12, 4);
        sc.fillStyle(0x002255);
        sc.fillCircle(16, 12, 3);
        sc.fillStyle(0x3366cc);
        sc.fillCircle(16, 12, 1);
        sc.fillStyle(0xff1744);
        sc.fillRect(24, 7, 4, 4);
        sc.fillStyle(0xff6666, 0.6);
        sc.fillRect(25, 8, 2, 2);
        sc.generateTexture('scn-sec-camera', 32, 22);
        sc.destroy();
    }
    genLevel1Scenery() {
        // Horizontal I-beam girder (192×20)
        const gb = this.g();
        gb.fillStyle(0x37474f);
        gb.fillRect(0, 4, 192, 12); // web
        gb.fillStyle(0x546e7a);
        gb.fillRect(0, 0, 192, 4); // top flange
        gb.fillStyle(0x263238);
        gb.fillRect(0, 16, 192, 4); // bottom flange
        gb.fillStyle(0x607d8b);
        gb.fillRect(0, 1, 192, 2); // top highlight
        // Rivet bolts
        for (let x = 12; x < 192; x += 32) {
            gb.fillStyle(0x78909c);
            gb.fillRect(x, 6, 6, 8);
            gb.fillStyle(0x90a4ae);
            gb.fillRect(x + 1, 7, 2, 2);
        }
        gb.generateTexture('scn-girder', 192, 20);
        gb.destroy();
        // Porthole viewport (60×60)
        const vp = this.g();
        vp.fillStyle(0x263238);
        vp.fillCircle(30, 30, 29); // outer rim
        vp.fillStyle(0x546e7a);
        vp.fillCircle(30, 30, 27); // rim bevel
        vp.fillStyle(0x0d1b2a);
        vp.fillCircle(30, 30, 23); // glass
        vp.fillStyle(0x001a3a, 0.8);
        vp.fillCircle(30, 30, 22); // deep space
        // Stars in glass
        for (const [sx, sy] of [[22, 24], [36, 18], [18, 34], [38, 36], [28, 38], [32, 22], [24, 40]]) {
            vp.fillStyle(0xffffff, 0.9);
            vp.fillRect(sx, sy, 2, 2);
        }
        // Rim bolts
        for (let a = 0; a < 6; a++) {
            const bx = 30 + Math.round(Math.cos(a * Math.PI / 3) * 26);
            const by = 30 + Math.round(Math.sin(a * Math.PI / 3) * 26);
            vp.fillStyle(0x78909c);
            vp.fillRect(bx - 2, by - 2, 4, 4);
        }
        // Reflection glints
        vp.fillStyle(0xffffff, 0.35);
        vp.fillEllipse(22, 20, 10, 5);
        vp.generateTexture('scn-viewport', 60, 60);
        vp.destroy();
        // Equipment panel with lights (104×48)
        const ep = this.g();
        ep.fillStyle(0x37474f);
        ep.fillRect(0, 0, 104, 48);
        ep.fillStyle(0x546e7a);
        ep.fillRect(0, 0, 104, 3); // top edge
        ep.fillStyle(0x263238);
        ep.fillRect(0, 45, 104, 3); // bottom edge
        ep.fillStyle(0x1a2a36);
        ep.fillRect(6, 8, 44, 28); // dark screen area
        ep.fillStyle(0x002244);
        ep.fillRect(8, 10, 40, 24); // screen glow
        // Screen scanlines
        for (let sy = 12; sy < 34; sy += 4) {
            ep.fillStyle(0x003366, 0.5);
            ep.fillRect(8, sy, 40, 2);
        }
        // LED indicators
        const leds = [0xff1744, 0x00e676, 0xffea00, 0x40c4ff, 0x00e676, 0xff1744];
        for (let i = 0; i < 6; i++) {
            ep.fillStyle(leds[i]);
            ep.fillRect(58 + i * 7, 10, 5, 5);
            ep.fillStyle(0xffffff, 0.5);
            ep.fillRect(59 + i * 7, 11, 2, 2);
        }
        // Buttons row
        ep.fillStyle(0x455a64);
        ep.fillRect(56, 22, 44, 14);
        for (let i = 0; i < 5; i++) {
            ep.fillStyle(0x607d8b);
            ep.fillRect(58 + i * 8, 25, 6, 8);
            ep.fillStyle(0x78909c);
            ep.fillRect(59 + i * 8, 26, 2, 2);
        }
        ep.generateTexture('scn-panel', 104, 48);
        ep.destroy();
        // Vertical support strut (20×96)
        const sv = this.g();
        sv.fillStyle(0x37474f);
        sv.fillRect(0, 0, 20, 96);
        sv.fillStyle(0x546e7a);
        sv.fillRect(0, 0, 4, 96); // left highlight
        sv.fillStyle(0x263238);
        sv.fillRect(16, 0, 4, 96); // right shadow
        // Cross-bracing rings every 24px
        for (let ry = 8; ry < 96; ry += 24) {
            sv.fillStyle(0x455a64);
            sv.fillRect(0, ry, 20, 6);
            sv.fillStyle(0x607d8b);
            sv.fillRect(2, ry + 1, 16, 2);
        }
        sv.generateTexture('scn-strut-v', 20, 96);
        sv.destroy();
        // Satellite dish (72×52)
        const sa = this.g();
        sa.fillStyle(0x546e7a);
        sa.fillRect(34, 30, 4, 22); // mast
        sa.fillStyle(0x455a64);
        sa.fillRect(28, 48, 16, 4); // base
        // Dish bowl (open ellipse = multiple arcs)
        sa.lineStyle(4, 0x78909c);
        sa.strokeEllipse(36, 24, 64, 36);
        sa.fillStyle(0x37474f, 0.6);
        sa.fillEllipse(36, 24, 60, 32);
        sa.lineStyle(2, 0x90a4ae);
        sa.strokeEllipse(36, 24, 64, 36);
        // Feed horn
        sa.fillStyle(0x90a4ae);
        sa.fillRect(34, 6, 4, 12);
        sa.fillStyle(0xb0bec5);
        sa.fillRect(32, 4, 8, 4);
        sa.generateTexture('scn-antenna', 72, 52);
        sa.destroy();
        // Warning stripe tape (88×14)
        const wt = this.g();
        for (let i = 0; i < 12; i++) {
            wt.fillStyle(i % 2 === 0 ? 0xffd600 : 0x111111);
            wt.fillRect(i * 8 - 4, 0, 12, 14);
        }
        wt.fillStyle(0xffd600, 0.3);
        wt.fillRect(0, 0, 88, 3); // sheen
        wt.generateTexture('scn-warning', 88, 14);
        wt.destroy();
    }
    genLevel2Scenery() {
        // Large asteroid (120×88)
        const al = this.g();
        al.fillStyle(0x3e2723);
        al.fillEllipse(60, 44, 112, 82); // body
        al.fillStyle(0x4e342e);
        al.fillEllipse(52, 36, 80, 60); // highlight mass
        al.fillStyle(0x5d4037);
        al.fillEllipse(38, 28, 40, 30); // lighter face
        al.fillStyle(0x6d4c41);
        al.fillEllipse(36, 26, 24, 18); // bright spot
        // Craters
        al.fillStyle(0x2a1a15);
        al.fillCircle(80, 30, 14);
        al.fillStyle(0x3e2723);
        al.fillCircle(80, 30, 10);
        al.fillStyle(0x2a1a15);
        al.fillCircle(42, 62, 10);
        al.fillStyle(0x3e2723);
        al.fillCircle(42, 62, 7);
        al.fillStyle(0x2a1a15);
        al.fillCircle(90, 58, 7);
        al.fillStyle(0x3e2723);
        al.fillCircle(90, 58, 5);
        // Surface detail lines
        al.lineStyle(2, 0x2a1a15, 0.5);
        al.strokeEllipse(60, 44, 108, 78);
        al.generateTexture('scn-asteroid-lg', 120, 88);
        al.destroy();
        // Small asteroid (56×40)
        const as = this.g();
        as.fillStyle(0x3e2723);
        as.fillEllipse(28, 20, 52, 36);
        as.fillStyle(0x4e342e);
        as.fillEllipse(22, 16, 32, 22);
        as.fillStyle(0x5d4037);
        as.fillEllipse(18, 14, 16, 12);
        as.fillStyle(0x2a1a15);
        as.fillCircle(38, 12, 7);
        as.fillStyle(0x3e2723);
        as.fillCircle(38, 12, 5);
        as.fillStyle(0x2a1a15);
        as.fillCircle(18, 28, 5);
        as.fillStyle(0x3e2723);
        as.fillCircle(18, 28, 3);
        as.generateTexture('scn-asteroid-sm', 56, 40);
        as.destroy();
        // Rocky formation / spire (48×72)
        const rf = this.g();
        rf.fillStyle(0x4e342e);
        rf.fillPoints([
            { x: 24, y: 0 }, { x: 40, y: 20 }, { x: 46, y: 40 }, { x: 44, y: 72 },
            { x: 4, y: 72 }, { x: 2, y: 40 }, { x: 8, y: 20 }
        ], true);
        rf.fillStyle(0x5d4037);
        rf.fillPoints([
            { x: 24, y: 0 }, { x: 32, y: 18 }, { x: 36, y: 40 }, { x: 24, y: 40 }, { x: 12, y: 36 }, { x: 16, y: 16 }
        ], true);
        rf.fillStyle(0x6d4c41, 0.6);
        rf.fillTriangle(24, 0, 20, 20, 28, 20);
        rf.fillStyle(0x2a1a15);
        rf.fillRect(6, 50, 36, 22); // base shadow
        rf.generateTexture('scn-rock-spire', 48, 72);
        rf.destroy();
        // Floating debris chunk (32×28)
        const dc = this.g();
        dc.fillStyle(0x4e342e);
        dc.fillPoints([
            { x: 8, y: 0 }, { x: 28, y: 2 }, { x: 32, y: 12 }, { x: 26, y: 28 }, { x: 6, y: 28 }, { x: 0, y: 16 }
        ], true);
        dc.fillStyle(0x5d4037);
        dc.fillPoints([
            { x: 8, y: 0 }, { x: 22, y: 2 }, { x: 26, y: 12 }, { x: 18, y: 20 }, { x: 6, y: 16 }
        ], true);
        dc.fillStyle(0x6d4c41);
        dc.fillRect(10, 4, 8, 6);
        dc.generateTexture('scn-debris', 32, 28);
        dc.destroy();
    }
    genLevel3Scenery() {
        // Tall crystal (28×80)
        const cl = this.g();
        // Facets
        cl.fillStyle(0x1565c0);
        cl.fillTriangle(14, 0, 28, 80, 0, 80); // base shape
        cl.fillStyle(0x1976d2);
        cl.fillTriangle(14, 0, 22, 80, 6, 80); // lighter face
        cl.fillStyle(0x42a5f5);
        cl.fillTriangle(14, 0, 18, 60, 10, 60); // bright face
        cl.fillStyle(0x90caf9, 0.6);
        cl.fillTriangle(14, 0, 16, 30, 12, 30); // near tip glow
        cl.lineStyle(2, 0x0d47a1);
        cl.lineBetween(14, 0, 0, 80);
        cl.lineStyle(2, 0x0d47a1);
        cl.lineBetween(14, 0, 28, 80);
        // Internal refraction lines
        cl.lineStyle(1, 0x64b5f6, 0.5);
        cl.lineBetween(14, 0, 8, 80);
        cl.lineStyle(1, 0x64b5f6, 0.5);
        cl.lineBetween(14, 0, 20, 80);
        cl.generateTexture('scn-crystal-lg', 28, 80);
        cl.destroy();
        // Short crystal (20×52)
        const cs = this.g();
        cs.fillStyle(0x4527a0);
        cs.fillTriangle(10, 0, 20, 52, 0, 52);
        cs.fillStyle(0x5e35b1);
        cs.fillTriangle(10, 0, 16, 52, 4, 52);
        cs.fillStyle(0x9575cd);
        cs.fillTriangle(10, 0, 13, 34, 7, 34);
        cs.fillStyle(0xd1c4e9, 0.5);
        cs.fillTriangle(10, 0, 11, 18, 9, 18);
        cs.lineStyle(1, 0x311b92);
        cs.lineBetween(10, 0, 0, 52);
        cs.lineStyle(1, 0x311b92);
        cs.lineBetween(10, 0, 20, 52);
        cs.generateTexture('scn-crystal-sm', 20, 52);
        cs.destroy();
        // Crystal cluster (88×68)
        const cc = this.g();
        // Multiple crystals overlapping
        cc.fillStyle(0x0d47a1);
        cc.fillTriangle(28, 0, 44, 68, 12, 68);
        cc.fillStyle(0x1565c0);
        cc.fillTriangle(28, 0, 36, 68, 16, 68);
        cc.fillStyle(0x1976d2);
        cc.fillTriangle(28, 0, 32, 44, 22, 44);
        cc.fillStyle(0x311b92);
        cc.fillTriangle(62, 8, 76, 68, 48, 68);
        cc.fillStyle(0x4527a0);
        cc.fillTriangle(62, 8, 70, 68, 52, 68);
        cc.fillStyle(0x5e35b1);
        cc.fillTriangle(62, 8, 67, 48, 57, 48);
        cc.fillStyle(0x7b1fa2);
        cc.fillTriangle(10, 18, 20, 68, 0, 68);
        cc.fillStyle(0x8e24aa);
        cc.fillTriangle(10, 18, 16, 68, 4, 68);
        cc.fillStyle(0x90caf9, 0.4);
        cc.fillRect(22, 0, 12, 30); // glow center
        cc.generateTexture('scn-crystal-cluster', 88, 68);
        cc.destroy();
        // Stalactite (24×60)
        const st = this.g();
        st.fillStyle(0x4a0000);
        st.fillTriangle(12, 60, 24, 0, 0, 0); // main body
        st.fillStyle(0x7f0000);
        st.fillTriangle(12, 60, 18, 0, 6, 0); // lighter face
        st.fillStyle(0xc62828);
        st.fillTriangle(12, 60, 15, 20, 9, 20); // hot crack face
        st.fillStyle(0xff5722, 0.5);
        st.fillRect(10, 50, 4, 8); // tip glow
        st.lineStyle(1, 0x2c0000);
        st.lineBetween(12, 60, 0, 0);
        st.lineStyle(1, 0x2c0000);
        st.lineBetween(12, 60, 24, 0);
        st.generateTexture('scn-stalactite', 24, 60);
        st.destroy();
        // Lava pool surface (128×22)
        const lp = this.g();
        lp.fillStyle(0x4a0000);
        lp.fillRect(0, 8, 128, 14); // deep lava
        lp.fillStyle(0xb71c1c);
        lp.fillRect(0, 4, 128, 8); // bright lava
        lp.fillStyle(0xff5722);
        lp.fillRect(0, 2, 128, 4); // surface
        lp.fillStyle(0xff8a65);
        lp.fillRect(0, 0, 128, 2); // hot edge
        // Bubbles
        for (const [bx, by, br] of [[16, 6, 4], [42, 4, 5], [78, 6, 4], [104, 4, 5], [58, 8, 3]]) {
            lp.fillStyle(0xff6f00);
            lp.fillCircle(bx, by, br);
            lp.fillStyle(0xff8a65);
            lp.fillCircle(bx - 1, by - 1, Math.max(1, br - 2));
        }
        lp.generateTexture('scn-lava-pool', 128, 22);
        lp.destroy();
        // Heat vent (32×32)
        const hv = this.g();
        hv.fillStyle(0x263238);
        hv.fillRect(0, 8, 32, 24); // body
        hv.fillStyle(0x37474f);
        hv.fillRect(0, 8, 32, 6); // top rim
        hv.fillStyle(0x1a0000);
        hv.fillEllipse(16, 14, 24, 14); // vent opening
        // Heat shimmer rings
        hv.lineStyle(2, 0xff5722, 0.7);
        hv.strokeEllipse(16, 8, 24, 10);
        hv.lineStyle(2, 0xff8a65, 0.4);
        hv.strokeEllipse(16, 4, 28, 10);
        hv.lineStyle(2, 0xffab40, 0.2);
        hv.strokeEllipse(16, 0, 32, 10);
        hv.generateTexture('scn-vent', 32, 32);
        hv.destroy();
    }
    genCollectibles() {
        // Heart — Zelda-style pixel heart
        const ht = this.g();
        ht.fillStyle(0xff1744);
        ht.fillRect(1, 2, 8, 1);
        ht.fillRect(15, 2, 8, 1);
        ht.fillRect(1, 3, 9, 1);
        ht.fillRect(14, 3, 9, 1);
        ht.fillRect(0, 4, 11, 1);
        ht.fillRect(13, 4, 11, 1);
        ht.fillRect(0, 5, 24, 8);
        ht.fillRect(1, 13, 22, 2);
        ht.fillRect(3, 15, 18, 2);
        ht.fillRect(5, 17, 14, 2);
        ht.fillRect(7, 19, 10, 2);
        ht.fillRect(9, 21, 6, 2);
        ht.fillRect(11, 23, 2, 2);
        ht.fillStyle(0xff8fa3);
        ht.fillRect(3, 3, 4, 4);
        ht.fillStyle(0xff8fa3);
        ht.fillRect(17, 3, 4, 4);
        ht.generateTexture('item-heart', 24, 28);
        ht.destroy();
        // Ability icons (16×16)
        const ifire = this.g();
        ifire.fillStyle(0xff6600);
        ifire.fillRect(7, 0, 2, 2);
        ifire.fillRect(5, 2, 6, 3);
        ifire.fillRect(4, 5, 8, 5);
        ifire.fillRect(3, 10, 10, 4);
        ifire.fillStyle(0xff0000);
        ifire.fillRect(6, 4, 4, 6);
        ifire.fillStyle(0xffdd00);
        ifire.fillRect(7, 7, 2, 5);
        ifire.generateTexture('icon-fire', 16, 16);
        ifire.destroy();
        const ilightning = this.g();
        ilightning.fillStyle(0xffdd00);
        ilightning.fillRect(9, 1, 4, 6);
        ilightning.fillRect(5, 7, 6, 2);
        ilightning.fillRect(3, 9, 4, 6);
        ilightning.fillStyle(0xffffff);
        ilightning.fillRect(10, 2, 2, 3);
        ilightning.generateTexture('icon-lightning', 16, 16);
        ilightning.destroy();
        const iice = this.g();
        iice.fillStyle(0x88ddff);
        iice.fillRect(7, 0, 2, 16);
        iice.fillRect(0, 7, 16, 2);
        iice.fillRect(3, 3, 2, 2);
        iice.fillRect(11, 3, 2, 2);
        iice.fillRect(3, 11, 2, 2);
        iice.fillRect(11, 11, 2, 2);
        iice.fillStyle(0xffffff);
        iice.fillRect(7, 0, 2, 3);
        iice.generateTexture('icon-ice', 16, 16);
        iice.destroy();
        // Star — extra life
        const ls = this.g();
        ls.fillStyle(0xffd600);
        ls.fillPoints(this.starPts(14, 14, 13, 5, 5), true);
        ls.fillStyle(0xffe57f);
        ls.fillPoints(this.starPts(14, 14, 6, 2, 5), true);
        ls.fillStyle(0xffffff, 0.7);
        ls.fillRect(10, 8, 5, 4); // sheen
        ls.lineStyle(2, 0xf9a825);
        ls.strokePoints(this.starPts(14, 14, 13, 5, 5), true);
        ls.generateTexture('item-life', 28, 28);
        ls.destroy();
        // Ability orb — generic (tinted at runtime per ability)
        const ob = this.g();
        ob.fillStyle(0xffffff);
        ob.fillCircle(12, 12, 11); // white base (tinted)
        ob.fillStyle(0xffffff, 0.6);
        ob.fillEllipse(8, 8, 10, 6); // inner glow
        ob.lineStyle(2, 0xcccccc);
        ob.strokeCircle(12, 12, 11);
        ob.fillStyle(0xffffff, 0.9);
        ob.fillRect(7, 6, 4, 3); // specular
        ob.generateTexture('item-orb', 24, 24);
        ob.destroy();
        // Mystery "?" item — purple diamond with question mark
        const mq = this.g();
        // Diamond shape
        mq.fillStyle(0x6a0080);
        mq.fillTriangle(14, 0, 28, 14, 14, 28);
        mq.fillTriangle(14, 0, 0, 14, 14, 28);
        mq.fillStyle(0xce93d8);
        mq.fillTriangle(14, 3, 25, 14, 14, 25);
        mq.fillTriangle(14, 3, 3, 14, 14, 25);
        mq.fillStyle(0x9c27b0, 0.7);
        mq.fillTriangle(14, 3, 14, 14, 8, 14);
        // "?" mark
        mq.fillStyle(0xffffff);
        mq.fillRect(11, 7, 6, 2); // top arc of ?
        mq.fillRect(15, 9, 2, 4); // right side
        mq.fillRect(11, 11, 4, 2); // curve to center
        mq.fillRect(11, 17, 3, 3); // dot
        // bright edge sheen
        mq.lineStyle(1, 0xf3e5f5, 0.8);
        mq.lineBetween(14, 0, 28, 14);
        mq.generateTexture('item-mystery', 28, 28);
        mq.destroy();
    }
    genPlanet(key, r, base, land, atmo) {
        const size = r * 2 + 8;
        const cx = size / 2, cy = size / 2;
        const g = this.g();
        g.fillStyle(base);
        g.fillCircle(cx, cy, r);
        g.fillStyle(land, 0.7);
        g.fillEllipse(cx - r * 0.2, cy - r * 0.1, r * 0.9, r * 0.6);
        g.fillEllipse(cx + r * 0.3, cy + r * 0.2, r * 0.7, r * 0.4);
        g.lineStyle(3, atmo, 0.5);
        g.strokeCircle(cx, cy, r + 1);
        g.generateTexture(key, size, size);
        g.destroy();
    }
    // ── backgrounds (512×512 tileable) ──────────────────────────────────────────
    genBackgrounds() {
        // Shared star field — used as far layer across all levels
        const sf = this.g();
        sf.fillStyle(0x080818);
        sf.fillRect(0, 0, 512, 512);
        // Tiny stars
        for (let i = 0; i < 80; i++) {
            const x = Math.floor(Math.random() * 512);
            const y = Math.floor(Math.random() * 512);
            const v = 180 + Math.floor(Math.random() * 75);
            sf.fillStyle(Phaser.Display.Color.GetColor(v, v, Math.min(255, v + 30)));
            const s = Math.random() < 0.15 ? 2 : 1;
            sf.fillRect(x, y, s, s);
        }
        sf.generateTexture('bg-stars', 512, 512);
        sf.destroy();
        // Level 1 mid — blue/purple nebula
        this.genNebula('bg-nebula-blue', [0x1a0050, 0x002080, 0x0a006a, 0x1b004a]);
        // Level 2 mid — deeper purple
        this.genNebula('bg-nebula-purple', [0x2d0050, 0x4a0080, 0x1a0050, 0x300040]);
        // Level 3 mid — red/orange (core heat)
        this.genNebula('bg-nebula-red', [0x4a0000, 0x7f0000, 0x3d0000, 0x5a0000]);
    }
    genNebula(key, colors) {
        const g = this.g();
        g.fillStyle(0x080818);
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const rx = 60 + Math.random() * 100;
            const ry = 40 + Math.random() * 80;
            const c = colors[i % colors.length];
            g.fillStyle(c, 0.18 + Math.random() * 0.18);
            g.fillEllipse(x, y, rx, ry);
        }
        // Faint stars on top
        for (let i = 0; i < 30; i++) {
            const x = Math.floor(Math.random() * 512);
            const y = Math.floor(Math.random() * 512);
            g.fillStyle(0xffffff, 0.6);
            g.fillRect(x, y, 1, 1);
        }
        g.generateTexture(key, 512, 512);
        g.destroy();
    }
    // ── interior level backgrounds ───────────────────────────────────────────────
    genInteriorBackgrounds() {
        this.genStationInterior();
        this.genCaveRock();
        this.genMagmaWall();
        this.genSciFiBackgrounds();
        this.genCastleBackgrounds();
    }
    genStationInterior() {
        // Far layer — metal hull plating with pipes, panels, and lighting strips
        const g = this.g();
        g.fillStyle(0x0b0f18);
        g.fillRect(0, 0, 512, 512);
        // 4 horizontal panel rows (128px each)
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x131b2a : 0x0f1420);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x1e2d42);
            g.fillRect(0, py, 512, 2); // top seam highlight
            g.fillStyle(0x04070d);
            g.fillRect(0, py + 126, 512, 2); // bottom seam shadow
            // 4 vertical columns per panel
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x04070d);
                g.fillRect(px, py + 2, 2, 124); // vertical seam dark
                g.fillStyle(0x1c2a3c);
                g.fillRect(px + 2, py + 2, 1, 124); // seam edge bright
                // Rivet bolts
                g.fillStyle(0x263a52);
                g.fillRect(px + 7, py + 7, 7, 7);
                g.fillStyle(0x384e68);
                g.fillRect(px + 8, py + 8, 3, 2);
                g.fillStyle(0x04070d);
                g.fillRect(px + 10, py + 10, 3, 3);
                g.fillStyle(0x263a52);
                g.fillRect(px + 7, py + 114, 7, 7);
                g.fillStyle(0x384e68);
                g.fillRect(px + 8, py + 115, 3, 2);
                g.fillStyle(0x04070d);
                g.fillRect(px + 10, py + 117, 3, 3);
            }
        }
        // Main pipe conduit between rows 1 and 2
        const pipeY = 248;
        g.fillStyle(0x14203a);
        g.fillRect(0, pipeY, 512, 18);
        g.fillStyle(0x243452);
        g.fillRect(0, pipeY, 512, 4);
        g.fillStyle(0x050810);
        g.fillRect(0, pipeY + 14, 512, 4);
        for (let fx = 14; fx < 512; fx += 72) {
            g.fillStyle(0x1a2e48);
            g.fillRect(fx, pipeY - 6, 12, 30);
            g.fillStyle(0x2a4260);
            g.fillRect(fx + 1, pipeY - 5, 10, 4);
            g.fillStyle(0x05080f);
            g.fillRect(fx + 1, pipeY + 24, 10, 4);
        }
        // Thinner cable bundle near top of panel row 1
        g.fillStyle(0x0e1826);
        g.fillRect(0, 120, 512, 8);
        g.fillStyle(0x1a2c40);
        g.fillRect(0, 120, 512, 2);
        g.fillStyle(0x030508);
        g.fillRect(0, 126, 512, 2);
        for (let cx = 24; cx < 512; cx += 56) {
            g.fillStyle(0x1e3050);
            g.fillRect(cx, 118, 8, 12);
            g.fillStyle(0x283e60);
            g.fillRect(cx + 1, 119, 6, 3);
        }
        // Equipment panels on wall face (small screen recesses)
        for (const [px, py] of [[64, 200], [192, 80], [320, 330], [448, 200], [128, 440], [384, 60]]) {
            g.fillStyle(0x0e1828);
            g.fillRect(px - 14, py - 10, 28, 20);
            g.fillStyle(0x001c2e);
            g.fillRect(px - 12, py - 8, 24, 16);
            g.fillStyle(0x002840, 0.7);
            g.fillRect(px - 11, py - 7, 22, 14);
            g.fillStyle(0x003858, 0.4);
            g.fillRect(px - 10, py - 6, 20, 12);
            g.fillStyle(0x00cc44, 0.85);
            g.fillRect(px - 10, py + 5, 3, 3);
            g.fillStyle(0xff4400, 0.7);
            g.fillRect(px - 5, py + 5, 3, 3);
        }
        // Vent grille strip at y=380
        g.fillStyle(0x0a1020);
        g.fillRect(0, 377, 512, 10);
        for (let vx = 4; vx < 512; vx += 12) {
            g.fillStyle(0x0e1828);
            g.fillRect(vx, 379, 8, 6);
            g.fillStyle(0x06090f);
            g.fillRect(vx + 1, 380, 4, 4);
        }
        // Ceiling lighting housing
        g.fillStyle(0x0a1520);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x152030, 0.8);
        g.fillRect(0, 2, 512, 4);
        g.fillStyle(0x1a2a38, 0.5);
        g.fillRect(0, 3, 512, 2);
        g.generateTexture('bg-station-interior', 512, 512);
        g.destroy();
        // Mid layer — ambient blue glow and scan lines (transparent base)
        const gm = this.g();
        // Ceiling light diffuse
        for (let i = 0; i < 8; i++) {
            gm.fillStyle(0x001e34, 0.055 - i * 0.006);
            gm.fillRect(0, i * 5, 512, 5);
        }
        // Faint horizontal scan lines across whole texture
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x00101c, 0.035);
            gm.fillRect(0, y, 512, 2);
        }
        // Screen glow patches around the equipment panels
        for (const [x, y] of [[64, 200], [320, 330], [448, 200], [128, 440], [384, 60]]) {
            gm.fillStyle(0x001828, 0.22);
            gm.fillEllipse(x, y, 70, 35);
            gm.fillStyle(0x002840, 0.13);
            gm.fillEllipse(x, y, 36, 18);
        }
        // Pipe glow halo
        gm.fillStyle(0x001428, 0.1);
        gm.fillRect(0, pipeY - 8, 512, 34);
        // Warning indicator glows at bottom
        for (const x of [48, 160, 272, 384, 496]) {
            gm.fillStyle(0x441000, 0.2);
            gm.fillEllipse(x, 508, 28, 10);
            gm.fillStyle(0xaa3300, 0.12);
            gm.fillEllipse(x, 508, 12, 5);
        }
        gm.generateTexture('bg-station-glow', 512, 512);
        gm.destroy();
    }
    genCaveRock() {
        // Far layer — rough asteroid cave walls with mineral dust
        const g = this.g();
        g.fillStyle(0x0a0806);
        g.fillRect(0, 0, 512, 512);
        // Large rock mass blobs
        for (let i = 0; i < 16; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const rx = 50 + Math.random() * 120, ry = rx * (0.4 + Math.random() * 0.5);
            const shades = [0x161008, 0x1c1409, 0x201a0a, 0x181209];
            g.fillStyle(shades[Math.floor(Math.random() * 4)], 0.5 + Math.random() * 0.35);
            g.fillEllipse(x, y, rx * 2, ry * 2);
        }
        // Mid-detail blobs
        for (let i = 0; i < 24; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const rx = 15 + Math.random() * 45, ry = rx * (0.5 + Math.random() * 0.5);
            const shades = [0x241a0c, 0x281e0e, 0x2c200f, 0x1e160a];
            g.fillStyle(shades[Math.floor(Math.random() * 4)], 0.4 + Math.random() * 0.3);
            g.fillEllipse(x, y, rx * 2, ry * 2);
        }
        // Surface cracks
        for (let i = 0; i < 14; i++) {
            const x1 = Math.random() * 512, y1 = Math.random() * 512;
            const x2 = x1 + (Math.random() - 0.5) * 90, y2 = y1 + (Math.random() - 0.5) * 70;
            g.lineStyle(1, 0x040300, 0.55);
            g.lineBetween(x1, y1, x2, y2);
        }
        // Mineral dust / particle glints
        for (let i = 0; i < 70; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const t = Math.floor(Math.random() * 3);
            if (t === 0) {
                g.fillStyle(0x664400, 0.38);
                g.fillRect(x, y, 2, 2);
                g.fillStyle(0xaa6600, 0.22);
                g.fillRect(x, y, 1, 1);
            }
            else if (t === 1) {
                g.fillStyle(0x112244, 0.3);
                g.fillRect(x, y, 2, 2);
                g.fillStyle(0x224488, 0.18);
                g.fillRect(x, y, 1, 1);
            }
            else {
                g.fillStyle(0x2a2420, 0.45);
                g.fillRect(x, y, 1, 1);
            }
        }
        g.generateTexture('bg-cave-rock', 512, 512);
        g.destroy();
        // Mid layer — amber mineral glow and crystal scatter (transparent base)
        const gm = this.g();
        for (let i = 0; i < 9; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            gm.fillStyle(0x2a1000, 0.28);
            gm.fillEllipse(x, y, 110 + Math.random() * 90, 40 + Math.random() * 36);
            gm.fillStyle(0x4a2000, 0.18);
            gm.fillEllipse(x, y, 55 + Math.random() * 40, 18 + Math.random() * 18);
            gm.fillStyle(0x774400, 0.1);
            gm.fillEllipse(x, y, 22, 9);
        }
        for (let i = 0; i < 7; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            gm.fillStyle(0x001128, 0.22);
            gm.fillEllipse(x, y, 50, 20);
            gm.fillStyle(0x002244, 0.14);
            gm.fillEllipse(x, y, 24, 10);
            gm.fillStyle(0x3366aa, 0.07);
            gm.fillEllipse(x, y, 10, 4);
        }
        gm.generateTexture('bg-cave-glow', 512, 512);
        gm.destroy();
    }
    genMagmaWall() {
        // Far layer — dark basalt with glowing magma seams and pooling lava
        const g = this.g();
        g.fillStyle(0x0d0400);
        g.fillRect(0, 0, 512, 512);
        // Dark basalt rock masses
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const rx = 40 + Math.random() * 100, ry = rx * (0.35 + Math.random() * 0.5);
            const shades = [0x1a0600, 0x200800, 0x180500, 0x240900];
            g.fillStyle(shades[Math.floor(Math.random() * 4)], 0.5 + Math.random() * 0.35);
            g.fillEllipse(x, y, rx * 2, ry * 2);
        }
        // Brighter rock face highlights
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const rx = 20 + Math.random() * 50, ry = rx * (0.4 + Math.random() * 0.4);
            g.fillStyle(0x2e0a00, 0.35 + Math.random() * 0.2);
            g.fillEllipse(x, y, rx * 2, ry * 2);
        }
        // Glowing magma crack veins
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const len = 30 + Math.random() * 90;
            const angle = Math.random() * Math.PI * 2;
            const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
            g.lineStyle(5, 0x440a00, 0.28);
            g.lineBetween(x, y, x2, y2);
            g.lineStyle(3, 0x882000, 0.35);
            g.lineBetween(x, y, x2, y2);
            g.lineStyle(1, 0xff6600, 0.4);
            g.lineBetween(x, y, x2, y2);
        }
        // Magma pool blobs
        for (let i = 0; i < 7; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            g.fillStyle(0x3d0d00, 0.45);
            g.fillEllipse(x, y, 80 + Math.random() * 80, 28 + Math.random() * 28);
            g.fillStyle(0x7a2200, 0.3);
            g.fillEllipse(x, y, 40 + Math.random() * 40, 14 + Math.random() * 14);
            g.fillStyle(0xcc5500, 0.2);
            g.fillEllipse(x, y, 16, 7);
            g.fillStyle(0xff9900, 0.12);
            g.fillEllipse(x, y, 7, 3);
        }
        g.generateTexture('bg-magma-wall', 512, 512);
        g.destroy();
        // Mid layer — heat haze and glow (transparent base)
        const gm = this.g();
        // Warm underlit glow rising from bottom
        for (let i = 0; i < 10; i++) {
            gm.fillStyle(0x280800, 0.06 + i * 0.005);
            gm.fillRect(0, 512 - (i + 1) * 28, 512, 28);
        }
        // Heat shimmer bands
        for (let y = 0; y < 512; y += 42) {
            gm.fillStyle(0x1a0400, 0.04 + Math.random() * 0.03);
            gm.fillRect(0, y, 512, 21);
        }
        // Intense hot glow pools
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            gm.fillStyle(0x4a0e00, 0.28);
            gm.fillEllipse(x, y, 150, 58);
            gm.fillStyle(0x882000, 0.2);
            gm.fillEllipse(x, y, 70, 26);
            gm.fillStyle(0xdd5500, 0.12);
            gm.fillEllipse(x, y, 26, 10);
            gm.fillStyle(0xff9900, 0.06);
            gm.fillEllipse(x, y, 10, 4);
        }
        // Crack glow traces on the mid overlay
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * 512, y = Math.random() * 512;
            const len = 20 + Math.random() * 60;
            const angle = Math.random() * Math.PI * 2;
            const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
            gm.lineStyle(3, 0x882000, 0.22);
            gm.lineBetween(x, y, x2, y2);
            gm.lineStyle(1, 0xff6600, 0.28);
            gm.lineBetween(x, y, x2, y2);
        }
        gm.generateTexture('bg-magma-heat', 512, 512);
        gm.destroy();
    }
    // ── sci-fi space-castle backgrounds ─────────────────────────────────────────
    genSciFiBackgrounds() {
        this.genReactorCore();
        this.genCommandHull();
        this.genHullBreach();
        this.genCoolantBay();
        this.genNavBay();
        this.genThroneHall();
        this.genBridgeDeck();
    }
    // ── Reactor Core: deep violet hull, conduit pipes, glowing column housings ──
    genReactorCore() {
        const g = this.g();
        g.fillStyle(0x06020e);
        g.fillRect(0, 0, 512, 512);
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x100620 : 0x0c041a);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x1e0a3a);
            g.fillRect(0, py, 512, 2);
            g.fillStyle(0x030108);
            g.fillRect(0, py + 126, 512, 2);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x030108);
                g.fillRect(px, py + 2, 2, 124);
                g.fillStyle(0x180840);
                g.fillRect(px + 2, py + 2, 1, 124);
                g.fillStyle(0x2a0e50);
                g.fillRect(px + 6, py + 6, 8, 8);
                g.fillStyle(0x3d1470);
                g.fillRect(px + 7, py + 7, 4, 2);
                g.fillStyle(0x030108);
                g.fillRect(px + 9, py + 9, 4, 4);
                g.fillStyle(0x2a0e50);
                g.fillRect(px + 6, py + 114, 8, 8);
                g.fillStyle(0x3d1470);
                g.fillRect(px + 7, py + 115, 4, 2);
            }
        }
        const pY = 248;
        g.fillStyle(0x160632);
        g.fillRect(0, pY, 512, 20);
        g.fillStyle(0x280c60);
        g.fillRect(0, pY, 512, 5);
        g.fillStyle(0x350f80);
        g.fillRect(0, pY + 1, 512, 3);
        g.fillStyle(0x040010);
        g.fillRect(0, pY + 16, 512, 4);
        for (let fx = 18; fx < 512; fx += 72) {
            g.fillStyle(0x200a50);
            g.fillRect(fx, pY - 6, 14, 32);
            g.fillStyle(0x320e78);
            g.fillRect(fx + 1, pY - 5, 12, 5);
            g.fillStyle(0x030108);
            g.fillRect(fx + 1, pY + 24, 12, 5);
            g.fillStyle(0x7700cc);
            g.fillRect(fx + 4, pY + 6, 6, 8);
            g.fillStyle(0xaa44ff);
            g.fillRect(fx + 5, pY + 7, 4, 3);
        }
        for (const vx of [128, 384]) {
            g.fillStyle(0x14062a);
            g.fillRect(vx - 10, 0, 20, 512);
            g.fillStyle(0x220a4a);
            g.fillRect(vx - 8, 0, 4, 512);
            g.fillStyle(0x030108);
            g.fillRect(vx + 4, 0, 4, 512);
            for (let vy = 40; vy < 512; vy += 96) {
                g.fillStyle(0x5500aa);
                g.fillRect(vx - 6, vy, 12, 10);
                g.fillStyle(0x8822dd);
                g.fillRect(vx - 4, vy + 1, 8, 4);
                g.fillStyle(0xcc66ff);
                g.fillRect(vx - 2, vy + 2, 4, 2);
            }
        }
        g.fillStyle(0x0e0422);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x220a48);
        g.fillRect(0, 2, 512, 4);
        g.fillStyle(0x0a0418);
        g.fillRect(0, 378, 512, 10);
        for (let vx = 4; vx < 512; vx += 12) {
            g.fillStyle(0x0e0620);
            g.fillRect(vx, 380, 8, 6);
            g.fillStyle(0x04010a);
            g.fillRect(vx + 1, 381, 4, 4);
        }
        for (const [ex, ey] of [[64, 80], [192, 320], [320, 160], [448, 400], [96, 440], [416, 60]]) {
            g.fillStyle(0x0e0420);
            g.fillRect(ex - 14, ey - 10, 28, 20);
            g.fillStyle(0x16064a);
            g.fillRect(ex - 12, ey - 8, 24, 16);
            g.fillStyle(0x200868);
            g.fillRect(ex - 11, ey - 7, 22, 14);
            g.fillStyle(0x7700cc);
            g.fillRect(ex - 10, ey + 4, 4, 4);
            g.fillStyle(0xaa33ff);
            g.fillRect(ex - 5, ey + 4, 4, 4);
        }
        g.generateTexture('bg-reactor-core', 512, 512);
        g.destroy();
        const gm = this.g();
        for (let i = 0; i < 8; i++) {
            gm.fillStyle(0x1a0040, 0.05 - i * 0.005);
            gm.fillRect(0, i * 5, 512, 5);
        }
        gm.fillStyle(0x280060, 0.15);
        gm.fillRect(0, pY - 10, 512, 40);
        gm.fillStyle(0x3d0090, 0.10);
        gm.fillRect(0, pY - 4, 512, 28);
        for (const vx of [128, 384]) {
            gm.fillStyle(0x3d0090, 0.18);
            gm.fillEllipse(vx, 256, 50, 512);
            gm.fillStyle(0x6600cc, 0.08);
            gm.fillEllipse(vx, 256, 24, 256);
        }
        for (const [ex, ey] of [[64, 80], [320, 160], [448, 400]]) {
            gm.fillStyle(0x5500aa, 0.18);
            gm.fillEllipse(ex, ey, 60, 30);
            gm.fillStyle(0x8800ff, 0.10);
            gm.fillEllipse(ex, ey, 28, 14);
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x0c0022, 0.03);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-reactor-glow', 512, 512);
        gm.destroy();
    }
    // ── Command Hull: amber terminal rows, warning strips, inhabited steel ───────
    genCommandHull() {
        const g = this.g();
        g.fillStyle(0x08090f);
        g.fillRect(0, 0, 512, 512);
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x111520 : 0x0d1018);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x1c2438);
            g.fillRect(0, py, 512, 2);
            g.fillStyle(0x040508);
            g.fillRect(0, py + 126, 512, 2);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x040508);
                g.fillRect(px, py + 2, 2, 124);
                g.fillStyle(0x182030);
                g.fillRect(px + 2, py + 2, 1, 124);
                g.fillStyle(0x243040);
                g.fillRect(px + 6, py + 6, 8, 8);
                g.fillStyle(0x344860);
                g.fillRect(px + 7, py + 7, 4, 2);
                g.fillStyle(0x040508);
                g.fillRect(px + 9, py + 9, 4, 4);
                g.fillStyle(0x243040);
                g.fillRect(px + 6, py + 114, 8, 8);
            }
        }
        // Terminal monitor rows at y≈165 and y≈390
        for (const tY of [165, 390]) {
            g.fillStyle(0x0c1220);
            g.fillRect(0, tY - 4, 512, 36);
            g.fillStyle(0x141e2e);
            g.fillRect(0, tY - 2, 512, 3);
            g.fillStyle(0x040508);
            g.fillRect(0, tY + 30, 512, 3);
            for (let tx = 8; tx < 512; tx += 56) {
                g.fillStyle(0x0a1020);
                g.fillRect(tx, tY, 44, 22);
                g.fillStyle(0x001428);
                g.fillRect(tx + 2, tY + 2, 40, 18);
                // Screen content (data lines)
                g.fillStyle(0x00aa44, 0.7);
                g.fillRect(tx + 4, tY + 5, 28, 2);
                g.fillStyle(0x00aa44, 0.5);
                g.fillRect(tx + 4, tY + 9, 20, 2);
                g.fillStyle(0x0055cc, 0.6);
                g.fillRect(tx + 4, tY + 13, 34, 5);
                // Status LEDs
                g.fillStyle(0x00ee44);
                g.fillRect(tx + 36, tY + 4, 4, 4);
                g.fillStyle(0xffcc00);
                g.fillRect(tx + 36, tY + 10, 4, 4);
            }
        }
        // Emergency amber lighting strips at y≈120 and y≈450
        for (const lY of [120, 450]) {
            g.fillStyle(0x1a1000);
            g.fillRect(0, lY, 512, 6);
            for (let lx = 0; lx < 512; lx += 64) {
                g.fillStyle(0x4a2800);
                g.fillRect(lx, lY + 1, 52, 4);
                g.fillStyle(0x7a4400);
                g.fillRect(lx + 4, lY + 1, 44, 2);
                g.fillStyle(0x2a1400);
                g.fillRect(lx + 52, lY + 1, 12, 4);
            }
        }
        // Warning chevron tape across bottom panel seam
        for (let wx = 0; wx < 512; wx += 20) {
            g.fillStyle(wx % 40 === 0 ? 0x3a2000 : 0x0a0800);
            g.fillRect(wx, 254, 20, 5);
        }
        g.fillStyle(0x0c1018);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x1a2030, 0.8);
        g.fillRect(0, 2, 512, 4);
        g.fillStyle(0x080a10);
        g.fillRect(0, 378, 512, 10);
        for (let vx = 4; vx < 512; vx += 12) {
            g.fillStyle(0x0e1220);
            g.fillRect(vx, 380, 8, 6);
            g.fillStyle(0x060810);
            g.fillRect(vx + 1, 381, 4, 4);
        }
        g.generateTexture('bg-command-hull', 512, 512);
        g.destroy();
        const gm = this.g();
        for (const tY of [165, 390]) {
            gm.fillStyle(0x002010, 0.20);
            gm.fillRect(0, tY - 8, 512, 44);
            gm.fillStyle(0x001800, 0.12);
            gm.fillRect(0, tY, 512, 22);
            for (let tx = 8; tx < 512; tx += 56) {
                gm.fillStyle(0x001c08, 0.25);
                gm.fillEllipse(tx + 22, tY + 11, 52, 26);
                gm.fillStyle(0x004418, 0.15);
                gm.fillEllipse(tx + 22, tY + 11, 24, 12);
            }
        }
        for (const lY of [120, 450]) {
            gm.fillStyle(0x200e00, 0.20);
            gm.fillRect(0, lY - 6, 512, 18);
            for (let lx = 0; lx < 512; lx += 64) {
                gm.fillStyle(0x3c1800, 0.15);
                gm.fillEllipse(lx + 26, lY + 3, 64, 16);
                gm.fillStyle(0x6a2c00, 0.08);
                gm.fillEllipse(lx + 26, lY + 3, 30, 8);
            }
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x0a0600, 0.025);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-command-glow', 512, 512);
        gm.destroy();
    }
    // ── Hull Breach: cracked panels, starfield visible through ruptures ──────────
    genHullBreach() {
        const g = this.g();
        g.fillStyle(0x06080e);
        g.fillRect(0, 0, 512, 512);
        // Structural frame — wider beams, darker
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x0c1018 : 0x080c14);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x14202e);
            g.fillRect(0, py, 512, 2);
            g.fillStyle(0x030408);
            g.fillRect(0, py + 126, 512, 2);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x030408);
                g.fillRect(px, py + 2, 2, 124);
                g.fillStyle(0x10182a);
                g.fillRect(px + 2, py + 2, 1, 124);
                g.fillStyle(0x141e2c);
                g.fillRect(px + 6, py + 6, 8, 8);
                g.fillStyle(0x04060c);
                g.fillRect(px + 9, py + 9, 4, 4);
                g.fillStyle(0x141e2c);
                g.fillRect(px + 6, py + 114, 8, 8);
            }
        }
        // Breach "windows" — hull ruptures showing starfield
        const breachAreas = [
            [80, 55, 200, 110], // upper-left breach
            [310, 180, 160, 80], // mid breach
            [60, 310, 100, 60], // lower-left
            [360, 370, 140, 100], // lower-right breach
        ];
        for (const [bx, by, bw, bh] of breachAreas) {
            // Deep space void inside breach
            g.fillStyle(0x020408);
            g.fillRect(bx, by, bw, bh);
            g.fillStyle(0x03050c, 0.8);
            g.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
            // Stars scattered inside breach
            for (let s = 0; s < 18; s++) {
                const sx = bx + 4 + Math.floor(s * bw / 18);
                const sy = by + 4 + Math.floor((s * 37) % (bh - 8));
                const sv = 160 + Math.floor((s * 53) % 95);
                g.fillStyle(Phaser.Display.Color.GetColor(sv, sv, Math.min(255, sv + 40)));
                g.fillRect(sx, sy, s % 4 === 0 ? 2 : 1, s % 4 === 0 ? 2 : 1);
            }
            // Faint nebula blob inside breach
            g.fillStyle(0x0a1428, 0.4);
            g.fillEllipse(bx + bw / 2, by + bh / 2, bw * 0.6, bh * 0.5);
            g.fillStyle(0x0e1e3a, 0.25);
            g.fillEllipse(bx + bw / 2, by + bh / 2, bw * 0.3, bh * 0.25);
            // Jagged breach edge (notches cut into border)
            g.fillStyle(0x06080e);
            g.fillRect(bx, by, 6, 6);
            g.fillRect(bx + bw - 6, by, 6, 6);
            g.fillRect(bx, by + bh - 6, 6, 6);
            g.fillRect(bx + bw - 6, by + bh - 6, 6, 6);
            // Crack lines from breach corners (3-4px bent lines)
            g.lineStyle(2, 0x0a1218, 0.9);
            g.lineBetween(bx, by, bx - 12, by - 18);
            g.lineBetween(bx + bw, by, bx + bw + 10, by - 15);
            g.lineBetween(bx, by + bh, bx - 8, by + bh + 14);
            g.lineStyle(1, 0x080e14, 0.6);
            g.lineBetween(bx + bw / 2, by, bx + bw / 2 + 6, by - 22);
        }
        g.fillStyle(0x0a0e16);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x14202e, 0.8);
        g.fillRect(0, 2, 512, 4);
        g.generateTexture('bg-hull-breach', 512, 512);
        g.destroy();
        const gm = this.g();
        // Cold blue-white light emanating from breach areas
        for (const [bx, by, bw, bh] of breachAreas) {
            gm.fillStyle(0x0a1830, 0.28);
            gm.fillEllipse(bx + bw / 2, by + bh / 2, bw + 80, bh + 50);
            gm.fillStyle(0x102240, 0.18);
            gm.fillEllipse(bx + bw / 2, by + bh / 2, bw + 40, bh + 25);
            gm.fillStyle(0x1a3460, 0.10);
            gm.fillEllipse(bx + bw / 2, by + bh / 2, bw, bh);
        }
        // Subtle cold ambient
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x060c18, 0.03);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-breach-glow', 512, 512);
        gm.destroy();
    }
    // ── Coolant Bay: cylindrical tanks, teal pipe networks ──────────────────────
    genCoolantBay() {
        const g = this.g();
        g.fillStyle(0x04080c);
        g.fillRect(0, 0, 512, 512);
        // Dark teal base panels
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x080f14 : 0x060c10);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x0e1e28);
            g.fillRect(0, py, 512, 2);
            g.fillStyle(0x030508);
            g.fillRect(0, py + 126, 512, 2);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x030508);
                g.fillRect(px, py + 2, 2, 124);
                g.fillStyle(0x0a1820);
                g.fillRect(px + 2, py + 2, 1, 124);
                g.fillStyle(0x102030);
                g.fillRect(px + 6, py + 6, 8, 8);
                g.fillStyle(0x1a3448);
                g.fillRect(px + 7, py + 7, 4, 2);
                g.fillStyle(0x030508);
                g.fillRect(px + 9, py + 9, 4, 4);
                g.fillStyle(0x102030);
                g.fillRect(px + 6, py + 114, 8, 8);
            }
        }
        // Coolant tank cross-sections (front-view cylinders, repeating)
        const tanks = [
            [90, 100, 44], [240, 80, 36], [380, 110, 50],
            [60, 290, 38], [200, 310, 44], [340, 280, 36], [470, 300, 42],
            [130, 440, 40], [310, 460, 34], [440, 430, 46],
        ];
        for (const [tx, ty, tr] of tanks) {
            g.fillStyle(0x0e2030);
            g.fillCircle(tx, ty, tr);
            g.fillStyle(0x163040);
            g.fillCircle(tx, ty, tr - 4);
            g.fillStyle(0x0a1822);
            g.fillCircle(tx, ty, tr - 8);
            g.fillStyle(0x001c2a, 0.8);
            g.fillCircle(tx, ty, tr - 12);
            // Tank highlight arc (top-left sheen)
            g.fillStyle(0x204858, 0.7);
            g.fillEllipse(tx - tr * 0.3, ty - tr * 0.3, tr * 0.5, tr * 0.3);
            // Coolant level indicator
            g.fillStyle(0x007a8a);
            g.fillRect(tx + tr - 8, ty - 12, 5, 24);
            g.fillStyle(0x00b5c8);
            g.fillRect(tx + tr - 7, ty, 3, 12);
            g.fillStyle(0x00e5ff);
            g.fillRect(tx + tr - 7, ty + 4, 3, 4);
        }
        // Horizontal pipe network
        for (const [pY, col] of [[195, 0x0d2a34], [380, 0x0a2430]]) {
            g.fillStyle(col);
            g.fillRect(0, pY, 512, 8);
            g.fillStyle(0x143844);
            g.fillRect(0, pY, 512, 3);
            g.fillStyle(0x030810);
            g.fillRect(0, pY + 6, 512, 2);
            for (let fx = 22; fx < 512; fx += 68) {
                g.fillStyle(0x102030);
                g.fillRect(fx, pY - 4, 12, 16);
                g.fillStyle(0x1c3e52);
                g.fillRect(fx + 1, pY - 3, 10, 4);
                g.fillStyle(0x00aabb);
                g.fillRect(fx + 4, pY + 2, 4, 5);
            }
        }
        // Vertical pipe drops at x≈170, x≈340
        for (const vx of [170, 340]) {
            g.fillStyle(0x0d2a34);
            g.fillRect(vx, 0, 8, 512);
            g.fillStyle(0x143844);
            g.fillRect(vx, 0, 3, 512);
            g.fillStyle(0x030810);
            g.fillRect(vx + 6, 0, 2, 512);
            for (let vy = 20; vy < 512; vy += 80) {
                g.fillStyle(0x00aabb);
                g.fillRect(vx + 1, vy, 6, 5);
                g.fillStyle(0x00e5ff);
                g.fillRect(vx + 2, vy + 1, 4, 2);
            }
        }
        g.fillStyle(0x060c12);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x0e1c28, 0.8);
        g.fillRect(0, 2, 512, 4);
        g.generateTexture('bg-coolant-bay', 512, 512);
        g.destroy();
        const gm = this.g();
        for (const [tx, ty, tr] of tanks) {
            gm.fillStyle(0x001828, 0.22);
            gm.fillEllipse(tx, ty, (tr + 30) * 2, (tr + 18) * 1.4);
            gm.fillStyle(0x003040, 0.14);
            gm.fillEllipse(tx, ty, tr * 1.8, tr * 1.1);
            gm.fillStyle(0x00aabb, 0.06);
            gm.fillEllipse(tx, ty, tr * 1.0, tr * 0.6);
        }
        for (const [pY] of [[195], [380]]) {
            gm.fillStyle(0x002030, 0.18);
            gm.fillRect(0, pY - 8, 512, 24);
        }
        for (const vx of [170, 340]) {
            gm.fillStyle(0x002030, 0.14);
            gm.fillEllipse(vx + 4, 256, 30, 512);
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x000e14, 0.03);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-coolant-glow', 512, 512);
        gm.destroy();
    }
    // ── Nav Bay: deep indigo, holographic orbital ring charts ───────────────────
    genNavBay() {
        const g = this.g();
        g.fillStyle(0x03030a);
        g.fillRect(0, 0, 512, 512);
        // Very dark hull — barely visible seams
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x07070f : 0x050510);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x0e0e1c);
            g.fillRect(0, py, 512, 2);
            g.fillStyle(0x020208);
            g.fillRect(0, py + 126, 512, 2);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x020208);
                g.fillRect(px, py + 2, 2, 124);
                g.fillStyle(0x0a0a18);
                g.fillRect(px + 2, py + 2, 1, 124);
                g.fillStyle(0x0e0e20);
                g.fillRect(px + 6, py + 6, 8, 8);
                g.fillStyle(0x020208);
                g.fillRect(px + 9, py + 9, 4, 4);
            }
        }
        // Holographic star chart rings at several positions
        const charts = [
            [128, 140, 55], [384, 100, 45], [256, 370, 65],
            [80, 420, 35], [440, 360, 42],
        ];
        for (const [cx, cy, r] of charts) {
            // Outer rings (faint)
            g.lineStyle(1, 0x0a1444, 0.8);
            g.strokeCircle(cx, cy, r);
            g.lineStyle(1, 0x0c1850, 0.7);
            g.strokeCircle(cx, cy, r * 0.75);
            g.lineStyle(1, 0x0e1c5a, 0.6);
            g.strokeCircle(cx, cy, r * 0.52);
            g.lineStyle(1, 0x122060, 0.5);
            g.strokeCircle(cx, cy, r * 0.32);
            // Centre dot
            g.fillStyle(0x182870, 0.8);
            g.fillCircle(cx, cy, 3);
            g.fillStyle(0x2a44cc, 0.6);
            g.fillCircle(cx, cy, 2);
            g.fillStyle(0x4466ff, 0.5);
            g.fillCircle(cx, cy, 1);
            // Cross-hair lines through chart
            g.lineStyle(1, 0x0a1440, 0.4);
            g.lineBetween(cx - r, cy, cx + r, cy);
            g.lineBetween(cx, cy - r, cx, cy + r);
            // Tiny orbital dots on the rings
            for (let a = 0; a < 4; a++) {
                const ang = (a / 4) * Math.PI * 2;
                g.fillStyle(0x1e3488, 0.7);
                g.fillRect(Math.round(cx + Math.cos(ang) * r * 0.75) - 1, Math.round(cy + Math.sin(ang) * r * 0.75) - 1, 2, 2);
            }
        }
        // Sparse star scatter
        for (let i = 0; i < 55; i++) {
            const sx = (i * 97 + 11) % 512;
            const sy = (i * 67 + 23) % 512;
            const sv = 80 + (i * 37) % 80;
            g.fillStyle(Phaser.Display.Color.GetColor(sv, sv, Math.min(255, sv + 50)));
            g.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
        // Ceiling / floor housing strips — nearly invisible
        g.fillStyle(0x07070e);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x0c0c1a, 0.7);
        g.fillRect(0, 2, 512, 4);
        g.generateTexture('bg-nav-bay', 512, 512);
        g.destroy();
        const gm = this.g();
        for (const [cx, cy, r] of charts) {
            gm.fillStyle(0x060a2a, 0.25);
            gm.fillEllipse(cx, cy, r * 3, r * 2.2);
            gm.fillStyle(0x0a1040, 0.15);
            gm.fillEllipse(cx, cy, r * 1.8, r * 1.4);
            gm.fillStyle(0x1020a0, 0.06);
            gm.fillEllipse(cx, cy, r * 0.8, r * 0.6);
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x04040e, 0.025);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-nav-glow', 512, 512);
        gm.destroy();
    }
    // ── Throne Hall: command dais, gold/blue holographic pillars ─────────────────
    genThroneHall() {
        const g = this.g();
        g.fillStyle(0x060510);
        g.fillRect(0, 0, 512, 512);
        // Grander hull — wider vertical columns every 128px
        for (let col = 0; col < 4; col++) {
            const px = col * 128;
            g.fillStyle(0x0c0a1c);
            g.fillRect(px + 4, 0, 120, 512);
            g.fillStyle(0x100e24);
            g.fillRect(px + 4, 0, 120, 4);
            // Column edge trim (gold accent)
            g.fillStyle(0x1e1600);
            g.fillRect(px, 0, 4, 512);
            g.fillStyle(0x2e2200);
            g.fillRect(px + 1, 0, 2, 512);
            g.fillStyle(0x181200);
            g.fillRect(px + 2, 0, 1, 512);
            g.fillStyle(0x1e1600);
            g.fillRect(px + 124, 0, 4, 512);
        }
        // Horizontal band seams
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(0x0e0c1e);
            g.fillRect(0, py, 512, 3);
            g.fillStyle(0x1a1530);
            g.fillRect(0, py, 512, 1);
            // Gold accent ticks at column intersections
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x4a3800);
                g.fillRect(px, py, 4, 6);
                g.fillStyle(0x7a6000);
                g.fillRect(px + 1, py, 2, 3);
            }
        }
        // Central holographic pillar at x=256 — tall glowing column
        g.fillStyle(0x0a0818);
        g.fillRect(248, 0, 16, 512);
        g.fillStyle(0x100e24);
        g.fillRect(250, 0, 12, 512);
        for (let py = 0; py < 512; py += 80) {
            g.fillStyle(0x1a1060);
            g.fillRect(248, py, 16, 10);
            g.fillStyle(0x2a1888);
            g.fillRect(249, py + 1, 14, 4);
            g.fillStyle(0x3a20b0);
            g.fillRect(250, py + 2, 12, 2);
            g.fillStyle(0x6644ff);
            g.fillRect(252, py + 2, 8, 2);
        }
        // Holographic display panels on side walls
        for (const [ex, ey, ew, eh, ec] of [
            [40, 80, 80, 50, 0x003850],
            [392, 80, 80, 50, 0x003850],
            [40, 330, 80, 50, 0x380020],
            [392, 330, 80, 50, 0x380020],
        ]) {
            g.fillStyle(0x08060e);
            g.fillRect(ex, ey, ew, eh);
            g.fillStyle(ec);
            g.fillRect(ex + 2, ey + 2, ew - 4, eh - 4);
            g.fillStyle(0x000000, 0.6);
            g.fillRect(ex + 4, ey + 4, ew - 8, eh - 8);
            // Grid lines on display
            for (let dy = ey + 8; dy < ey + eh - 4; dy += 8) {
                g.fillStyle(0x00ccff, 0.15);
                g.fillRect(ex + 4, dy, ew - 8, 1);
            }
            // Corner brackets
            g.fillStyle(0x00aacc);
            g.fillRect(ex + 2, ey + 2, 8, 2);
            g.fillRect(ex + 2, ey + 2, 2, 8);
            g.fillStyle(0x00aacc);
            g.fillRect(ex + ew - 10, ey + 2, 8, 2);
            g.fillRect(ex + ew - 4, ey + 2, 2, 8);
        }
        g.fillStyle(0x0a0818);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x181030, 0.8);
        g.fillRect(0, 2, 512, 4);
        // Gold floor accent strip
        g.fillStyle(0x1e1600);
        g.fillRect(0, 506, 512, 6);
        g.fillStyle(0x3a2800);
        g.fillRect(0, 506, 512, 2);
        g.generateTexture('bg-throne-hall', 512, 512);
        g.destroy();
        const gm = this.g();
        // Blue holo panel glows
        for (const [ex, ey, ew, eh] of [[40, 80, 80, 50], [392, 80, 80, 50]]) {
            gm.fillStyle(0x001c30, 0.25);
            gm.fillEllipse(ex + ew / 2, ey + eh / 2, ew + 60, eh + 40);
            gm.fillStyle(0x003858, 0.15);
            gm.fillEllipse(ex + ew / 2, ey + eh / 2, ew + 20, eh + 14);
        }
        // Red panel glows
        for (const [ex, ey, ew, eh] of [[40, 330, 80, 50], [392, 330, 80, 50]]) {
            gm.fillStyle(0x1c000e, 0.22);
            gm.fillEllipse(ex + ew / 2, ey + eh / 2, ew + 60, eh + 40);
        }
        // Central pillar glow
        gm.fillStyle(0x1a0860, 0.22);
        gm.fillEllipse(256, 256, 80, 512);
        gm.fillStyle(0x2a10a0, 0.10);
        gm.fillEllipse(256, 256, 36, 256);
        // Gold column trim glow
        for (let col = 0; col < 4; col++) {
            const px = col * 128;
            gm.fillStyle(0x1e1000, 0.12);
            gm.fillEllipse(px + 2, 256, 14, 512);
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x080410, 0.03);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-throne-glow', 512, 512);
        gm.destroy();
    }
    // ── Bridge Deck: massive viewport showing red nebula, ominous command bridge ─
    genBridgeDeck() {
        const g = this.g();
        g.fillStyle(0x060408);
        g.fillRect(0, 0, 512, 512);
        // Heavy structural frame
        for (let row = 0; row < 4; row++) {
            const py = row * 128;
            g.fillStyle(row % 2 === 0 ? 0x0c080e : 0x080608);
            g.fillRect(0, py + 2, 512, 124);
            g.fillStyle(0x14101a);
            g.fillRect(0, py, 512, 3);
            g.fillStyle(0x020104);
            g.fillRect(0, py + 125, 512, 3);
            for (let col = 0; col < 4; col++) {
                const px = col * 128;
                g.fillStyle(0x020104);
                g.fillRect(px, py + 2, 3, 124);
                g.fillStyle(0x100c14);
                g.fillRect(px + 3, py + 2, 1, 124);
                g.fillStyle(0x16101e);
                g.fillRect(px + 7, py + 7, 6, 6);
                g.fillStyle(0x020104);
                g.fillRect(px + 9, py + 9, 3, 3);
            }
        }
        // Main viewport — large dark window showing red nebula
        const vpX = 80, vpY = 60, vpW = 352, vpH = 200;
        g.fillStyle(0x030105);
        g.fillRect(vpX, vpY, vpW, vpH);
        // Nebula layers inside viewport
        g.fillStyle(0x1a0408, 0.5);
        g.fillEllipse(vpX + vpW * 0.4, vpY + vpH * 0.5, vpW * 0.7, vpH * 0.6);
        g.fillStyle(0x280608, 0.3);
        g.fillEllipse(vpX + vpW * 0.6, vpY + vpH * 0.4, vpW * 0.5, vpH * 0.4);
        g.fillStyle(0x3a0c0c, 0.2);
        g.fillEllipse(vpX + vpW * 0.3, vpY + vpH * 0.6, vpW * 0.4, vpH * 0.3);
        g.fillStyle(0x120208, 0.3);
        g.fillEllipse(vpX + vpW * 0.7, vpY + vpH * 0.3, vpW * 0.3, vpH * 0.35);
        // Stars in viewport
        for (let i = 0; i < 28; i++) {
            const sx = vpX + 4 + (i * 83) % (vpW - 8);
            const sy = vpY + 4 + (i * 61) % (vpH - 8);
            const sv = 120 + (i * 41) % 80;
            g.fillStyle(Phaser.Display.Color.GetColor(sv, Math.floor(sv * 0.6), Math.floor(sv * 0.6)));
            g.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
        // Viewport frame
        g.lineStyle(4, 0x1e1420, 1);
        g.strokeRect(vpX, vpY, vpW, vpH);
        g.lineStyle(2, 0x2a1c30, 0.8);
        g.strokeRect(vpX + 2, vpY + 2, vpW - 4, vpH - 4);
        // Viewport corner brackets
        for (const [cx, cy] of [[vpX, vpY], [vpX + vpW, vpY], [vpX, vpY + vpH], [vpX + vpW, vpY + vpH]]) {
            const dx = cx === vpX ? 1 : -1, dy = cy === vpY ? 1 : -1;
            g.fillStyle(0x2a1c38);
            g.fillRect(cx, cy, dx * 16, 3);
            g.fillRect(cx, cy, 3, dy * 16);
        }
        // Tactical console silhouettes below viewport
        for (let cx = 60; cx < 512; cx += 110) {
            g.fillStyle(0x0a0810);
            g.fillRect(cx, 310, 80, 40);
            g.fillStyle(0x0e0c18);
            g.fillRect(cx + 2, 312, 76, 36);
            g.fillStyle(0x010003);
            g.fillRect(cx + 6, 316, 68, 28);
            // Console screen (very dim red)
            g.fillStyle(0x280008, 0.6);
            g.fillRect(cx + 8, 318, 64, 24);
            g.fillStyle(0x1a0005, 0.8);
            g.fillRect(cx + 10, 320, 60, 20);
            // Warning red LEDs
            g.fillStyle(0x880010);
            g.fillRect(cx + 62, 313, 4, 4);
            g.fillStyle(0xff0022);
            g.fillRect(cx + 63, 314, 2, 2);
        }
        g.fillStyle(0x08060c);
        g.fillRect(0, 0, 512, 8);
        g.fillStyle(0x120e1c, 0.8);
        g.fillRect(0, 2, 512, 4);
        g.generateTexture('bg-bridge-deck', 512, 512);
        g.destroy();
        const gm = this.g();
        // Red nebula viewport glow
        gm.fillStyle(0x1c0008, 0.30);
        gm.fillEllipse(vpX + vpW / 2, vpY + vpH / 2, vpW + 100, vpH + 80);
        gm.fillStyle(0x280010, 0.20);
        gm.fillEllipse(vpX + vpW / 2, vpY + vpH / 2, vpW + 40, vpH + 30);
        gm.fillStyle(0x3a0018, 0.12);
        gm.fillEllipse(vpX + vpW / 2, vpY + vpH / 2, vpW, vpH);
        // Console warning red glow
        for (let cx = 60; cx < 512; cx += 110) {
            gm.fillStyle(0x1c0008, 0.20);
            gm.fillEllipse(cx + 40, 330, 100, 50);
            gm.fillStyle(0x280010, 0.12);
            gm.fillEllipse(cx + 40, 330, 50, 25);
        }
        for (let y = 0; y < 512; y += 6) {
            gm.fillStyle(0x0a0406, 0.03);
            gm.fillRect(0, y, 512, 3);
        }
        gm.generateTexture('bg-bridge-glow', 512, 512);
        gm.destroy();
    }
    genCastleBackgrounds() {
        this.genGreatHall();
        this.genDungeon();
        this.genChapel();
        this.genCrypt();
        this.genSanctum();
    }
    genGreatHall() {
        const g = this.g();
        g.fillStyle(0x1e1a30, 1);
        g.fillRect(0, 0, 512, 512);
        // Offset brick rows
        for (let row = 0; row < 11; row++) {
            const by = row * 46;
            const off = (row % 2) * 28;
            for (let col = -1; col < 10; col++) {
                const bx = col * 56 + off;
                g.fillStyle(row % 3 === 0 ? 0x302840 : 0x281e3a, 1);
                g.fillRect(bx + 1, by + 1, 53, 43);
                g.fillStyle(0x141020, 1);
                g.fillRect(bx, by, 56, 1);
                g.fillRect(bx, by, 1, 46);
            }
        }
        // Gothic arched alcoves at 3 positions
        for (const ax of [85, 255, 425]) {
            g.fillStyle(0x08061a, 1);
            g.fillRect(ax - 42, 40, 84, 290); // deep space void
            // Stars inside arch — bright and visible
            for (let i = 0; i < 18; i++) {
                const sx = ax - 36 + (i * 5 + i * i) % 72;
                const sy = 55 + (i * 19 + 7) % 265;
                g.fillStyle(0xffffff, 0.55 + (i % 4) * 0.12);
                g.fillRect(sx, sy, 1 + (i % 2), 1 + (i % 2));
            }
            // Nebula tint in arch
            g.fillStyle(0x220055, 0.25);
            g.fillRect(ax - 40, 42, 80, 140);
            g.fillStyle(0x003366, 0.20);
            g.fillRect(ax - 40, 185, 80, 140);
            // Stone arch frame
            g.fillStyle(0x3a3258, 1);
            g.fillRect(ax - 46, 36, 6, 298);
            g.fillRect(ax + 40, 36, 6, 298);
            g.fillRect(ax - 44, 30, 88, 8);
            g.fillRect(ax - 34, 22, 68, 9);
            g.fillRect(ax - 20, 15, 40, 8);
            g.fillRect(ax - 8, 10, 16, 6);
        }
        // Torch brackets
        for (const tx of [170, 340]) {
            g.fillStyle(0x5a3a10, 1);
            g.fillRect(tx - 5, 185, 10, 4);
            g.fillRect(tx - 3, 175, 6, 12);
            g.fillStyle(0xff9900, 0.55);
            g.fillRect(tx - 14, 155, 28, 24);
            g.fillStyle(0xffee44, 0.35);
            g.fillRect(tx - 8, 148, 16, 18);
        }
        // Floor stone band
        g.fillStyle(0x28203c, 1);
        g.fillRect(0, 490, 512, 22);
        g.fillStyle(0x160e28, 1);
        g.fillRect(0, 490, 512, 2);
        g.generateTexture('bg-great-hall', 512, 512);
        g.destroy();
        const gm = this.g();
        gm.fillStyle(0x150e28, 0.55);
        gm.fillRect(0, 0, 512, 512);
        for (const tx of [170, 340]) {
            gm.fillStyle(0xff7700, 0.18);
            gm.fillRect(tx - 70, 130, 140, 110);
            gm.fillStyle(0xffcc00, 0.12);
            gm.fillRect(tx - 45, 145, 90, 75);
        }
        gm.fillStyle(0x0a0420, 0.40);
        gm.fillRect(0, 370, 512, 142);
        gm.generateTexture('bg-hall-glow', 512, 512);
        gm.destroy();
    }
    genDungeon() {
        const g = this.g();
        g.fillStyle(0x10101e, 1);
        g.fillRect(0, 0, 512, 512);
        // Heavy brick pattern
        for (let row = 0; row < 14; row++) {
            const by = row * 36;
            const off = (row % 2) * 30;
            for (let col = -1; col < 10; col++) {
                const bx = col * 60 + off;
                g.fillStyle(0x221e32, 1);
                g.fillRect(bx + 1, by + 1, 57, 33);
                g.fillStyle(0x0e0c1c, 1);
                g.fillRect(bx, by, 60, 1);
                g.fillRect(bx, by, 1, 36);
            }
        }
        // Hanging chains
        for (const cx of [64, 192, 320, 448]) {
            for (let link = 0; link < 9; link++) {
                const ly = link * 26 + 20;
                g.fillStyle(0x4a4460, 0.9);
                g.fillRect(cx - 3, ly, 6, 10);
                g.fillRect(cx - 5, ly + 10, 10, 5);
            }
        }
        // Barred windows
        for (const wx of [128, 384]) {
            g.fillStyle(0x06041a, 1);
            g.fillRect(wx - 22, 195, 44, 82);
            // Nebula glow behind bars
            g.fillStyle(0x3300aa, 0.30);
            g.fillRect(wx - 20, 197, 40, 38);
            g.fillStyle(0x0044aa, 0.25);
            g.fillRect(wx - 20, 235, 40, 40);
            for (let i = 0; i < 8; i++) { // stars behind bars
                g.fillStyle(0xffffff, 0.65);
                g.fillRect(wx - 16 + (i * 7) % 28, 206 + (i * 13) % 60, 1, 1);
            }
            for (let b = 0; b < 3; b++) { // bars
                g.fillStyle(0x5a5470, 0.9);
                g.fillRect(wx - 18 + b * 20, 193, 3, 86);
            }
            g.fillStyle(0x2e2a44, 1); // bar frame
            g.fillRect(wx - 24, 193, 6, 86);
            g.fillRect(wx + 18, 193, 6, 86);
            g.fillRect(wx - 24, 191, 50, 5);
            g.fillRect(wx - 24, 277, 50, 5);
        }
        // Cosmic energy seeping through cracks
        for (let i = 0; i < 6; i++) {
            g.fillStyle(0x4422aa, 0.15);
            g.fillRect(i * 86 + 30, 0, 6, 300 + (i * 37) % 180);
        }
        g.generateTexture('bg-dungeon', 512, 512);
        g.destroy();
        const gm = this.g();
        gm.fillStyle(0x0c0a1e, 0.60);
        gm.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 8; i++) {
            gm.fillStyle(0x2830aa, 0.18);
            gm.fillRect(i * 64 + 16, 0, 10, 512);
        }
        gm.generateTexture('bg-dungeon-glow', 512, 512);
        gm.destroy();
    }
    genChapel() {
        const g = this.g();
        g.fillStyle(0x1c1630, 1);
        g.fillRect(0, 0, 512, 512);
        // Ribbed vault ceiling
        for (let i = 0; i < 5; i++) {
            const cx = i * 128;
            g.fillStyle(0x3a3260, 0.9);
            g.fillRect(cx - 3, 0, 5, 200);
            g.fillRect(cx - 42, 170, 84, 5);
        }
        // Tall gothic windows
        for (const ax of [128, 384]) {
            // Window void (deep space)
            g.fillStyle(0x08041c, 1);
            g.fillRect(ax - 38, 25, 76, 295);
            // Vibrant stained glass panels
            const panes = [[0x5500cc, 50, 0x1100aa, 70], [0x0022ee, 60, 0x2200cc, 65], [0x4400aa, 55, 0x1144dd, 65]];
            let py = 35;
            for (const [c1, h1, c2, h2] of panes) {
                g.fillStyle(c1, 0.80);
                g.fillRect(ax - 34, py, 30, h1);
                g.fillStyle(c2, 0.80);
                g.fillRect(ax + 4, py, 30, h1);
                py += h1 + 8;
                g.fillStyle(c2, 0.65);
                g.fillRect(ax - 34, py, 64, h2);
                py += h2 + 8;
            }
            // Bright stars
            for (let i = 0; i < 16; i++) {
                g.fillStyle(0xffffff, 0.65 + (i % 4) * 0.09);
                g.fillRect(ax - 32 + (i * 5 + i) % 64, 34 + (i * 23) % 270, 1, 1);
            }
            // Arch frame (stone)
            g.fillStyle(0x3a3260, 1);
            g.fillRect(ax - 42, 25, 5, 300);
            g.fillRect(ax + 37, 25, 5, 300);
            g.fillRect(ax - 40, 20, 80, 6);
            g.fillRect(ax - 30, 14, 60, 7);
            g.fillRect(ax - 18, 8, 36, 7);
            g.fillRect(ax - 8, 3, 16, 6);
            // Mullion (center divider)
            g.fillStyle(0x28224a, 0.9);
            g.fillRect(ax - 2, 40, 4, 276);
        }
        // Stone pillar bases
        for (const px of [0, 256, 512]) {
            g.fillStyle(0x2a2240, 1);
            g.fillRect(px - 18, 340, 36, 172);
            g.fillStyle(0x3c3458, 0.8);
            g.fillRect(px - 20, 338, 40, 8);
        }
        // Candle glow at pillar bases
        for (const cx of [64, 192, 320, 448]) {
            g.fillStyle(0xffdd66, 0.22);
            g.fillRect(cx - 22, 445, 44, 55);
        }
        g.generateTexture('bg-chapel', 512, 512);
        g.destroy();
        const gm = this.g();
        gm.fillStyle(0x160e2c, 0.45);
        gm.fillRect(0, 0, 512, 512);
        for (const ax of [128, 384]) {
            gm.fillStyle(0x4400cc, 0.22);
            gm.fillRect(ax - 65, 15, 130, 330);
            gm.fillStyle(0x8844ff, 0.12);
            gm.fillRect(ax - 45, 25, 90, 310);
        }
        gm.generateTexture('bg-chapel-glow', 512, 512);
        gm.destroy();
    }
    genCrypt() {
        const g = this.g();
        g.fillStyle(0x0e0b1e, 1);
        g.fillRect(0, 0, 512, 512);
        // Stone pillar columns
        for (const px of [85, 256, 427]) {
            g.fillStyle(0x201c30, 1);
            g.fillRect(px - 26, 0, 52, 512);
            g.fillStyle(0x18162a, 0.7);
            g.fillRect(px - 22, 0, 3, 512);
            g.fillStyle(0x2a2840, 0.6);
            g.fillRect(px - 18, 0, 7, 512);
            // Column capitals
            g.fillStyle(0x2e2a44, 1);
            g.fillRect(px - 32, 0, 64, 22);
            g.fillRect(px - 30, 22, 60, 10);
            g.fillRect(px - 32, 490, 64, 22);
            g.fillRect(px - 30, 480, 60, 10);
            // Cosmic energy veins on columns
            g.fillStyle(0x6633bb, 0.20);
            g.fillRect(px - 8, 0, 3, 512);
            // Skull ornaments
            for (const sy of [120, 270, 400]) {
                g.fillStyle(0x2c2a42, 1);
                g.fillRect(px - 13, sy, 26, 22);
                g.fillRect(px - 9, sy + 22, 18, 8);
                g.fillStyle(0x080616, 1);
                g.fillRect(px - 10, sy + 5, 7, 7);
                g.fillRect(px + 3, sy + 5, 7, 7);
                g.fillRect(px - 5, sy + 14, 10, 4);
            }
        }
        // Space cracks glowing with cosmic energy
        for (const crx of [170, 340]) {
            g.fillStyle(0x8844ff, 0.35);
            g.fillRect(crx - 3, 0, 6, 90);
            g.fillRect(crx - 1, 0, 2, 65);
            for (let i = 0; i < 8; i++) {
                g.fillStyle(0xffffff, 0.75);
                g.fillRect(crx - 1, 8 + i * 12, 1, 1);
            }
        }
        // Floor stone slabs
        for (let i = 0; i < 8; i++) {
            g.fillStyle(0x1c1a2e, 0.8);
            g.fillRect(i * 64, 482, 62, 30);
            g.fillStyle(0x0e0c20, 0.9);
            g.fillRect(i * 64, 482, 62, 1);
        }
        g.generateTexture('bg-crypt', 512, 512);
        g.destroy();
        const gm = this.g();
        gm.fillStyle(0x07051a, 0.65);
        gm.fillRect(0, 0, 512, 512);
        for (const px of [85, 256, 427]) {
            gm.fillStyle(0x220088, 0.30);
            gm.fillRect(px - 45, 0, 90, 512);
        }
        gm.generateTexture('bg-crypt-glow', 512, 512);
        gm.destroy();
    }
    genSanctum() {
        const g = this.g();
        g.fillStyle(0x1a0a2e, 1);
        g.fillRect(0, 0, 512, 512);
        // Large cosmic arch window
        g.fillStyle(0x08041e, 1);
        g.fillRect(156, 40, 200, 240); // window void
        // Vibrant nebula fill in window
        g.fillStyle(0x440099, 0.92);
        g.fillRect(160, 44, 192, 50);
        g.fillStyle(0x220070, 0.88);
        g.fillRect(156, 94, 200, 55);
        g.fillStyle(0x5500bb, 0.85);
        g.fillRect(160, 149, 192, 50);
        g.fillStyle(0x6600dd, 0.78);
        g.fillRect(164, 199, 184, 50);
        g.fillStyle(0x4400aa, 0.82);
        g.fillRect(160, 249, 192, 26);
        // Bright stars in window
        const stars = [[20, 15], [80, 30], [140, 20], [170, 55], [30, 80], [110, 70], [165, 95], [40, 130], [100, 120], [180, 135], [25, 175], [145, 160], [70, 200], [190, 185], [55, 220], [130, 215]];
        for (const [sx, sy] of stars) {
            g.fillStyle(0xffffff, 0.70 + (sx % 5) * 0.07);
            g.fillRect(160 + sx, 44 + sy, 1 + (sy % 2), 1 + (sy % 2));
        }
        // Golden arch frame
        g.fillStyle(0x9c6a00, 1);
        g.fillRect(150, 36, 8, 248);
        g.fillRect(354, 36, 8, 248);
        g.fillRect(150, 34, 212, 8);
        g.fillRect(152, 278, 208, 8);
        g.fillStyle(0xccaa00, 0.7);
        g.fillRect(150, 38, 4, 240); // shine
        // Arch pointed top
        g.fillStyle(0x9c6a00, 1);
        g.fillRect(166, 26, 180, 8);
        g.fillRect(182, 19, 148, 8);
        g.fillRect(198, 13, 116, 7);
        g.fillRect(222, 7, 68, 7);
        // Side columns
        for (const px of [48, 464]) {
            g.fillStyle(0x2e1e40, 1);
            g.fillRect(px - 30, 0, 60, 512);
            g.fillStyle(0x9c6a00, 0.8);
            g.fillRect(px - 30, 0, 60, 14);
            g.fillRect(px - 30, 498, 60, 14);
            g.fillRect(px - 30, 250, 60, 8);
            g.fillStyle(0x8844cc, 0.35);
            g.fillRect(px - 18, 14, 6, 484);
        }
        // Bright rune energy lines on floor
        for (let i = 0; i < 5; i++) {
            g.fillStyle(0x8833ff, 0.45);
            g.fillRect(0, 385 + i * 18, 512, 5);
        }
        // Bright energy orbs
        for (const ox of [150, 256, 362]) {
            g.fillStyle(0xaa44ff, 0.55);
            g.fillRect(ox - 14, 355, 28, 28);
            g.fillStyle(0xcc88ff, 0.30);
            g.fillRect(ox - 22, 347, 44, 44);
        }
        g.generateTexture('bg-sanctum', 512, 512);
        g.destroy();
        const gm = this.g();
        gm.fillStyle(0x0e0530, 0.50);
        gm.fillRect(0, 0, 512, 512);
        gm.fillStyle(0x5500cc, 0.22);
        gm.fillRect(100, 20, 312, 320);
        gm.fillStyle(0x9933ff, 0.12);
        gm.fillRect(60, 0, 392, 400);
        gm.generateTexture('bg-sanctum-glow', 512, 512);
        gm.destroy();
    }
    // ── helpers ──────────────────────────────────────────────────────────────────
    g() { return this.make.graphics({ x: 0, y: 0 }); }
    starPts(cx, cy, outerR, innerR, n) {
        const pts = [];
        for (let i = 0; i < n * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI / n) - Math.PI / 2;
            pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
        }
        return pts;
    }
}
