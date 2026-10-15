import * as Phaser from 'phaser';
import { BuildingKind, Faction, PAL, TILE, UnitKind } from '@/config';
import { Grid, mulberry32 } from '@/world/Grid';

type Ctx = CanvasRenderingContext2D;
const OUTLINE = '#15171b';

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

const r = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** 1px dunkle Kontur um alle deckenden Pixel — der "Retro"-Look. */
function outline(ctx: Ctx, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img.data[(y * w + x) * 4 + 3]);
  ctx.fillStyle = OUTLINE;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) ctx.fillRect(x, y, 1, 1);
    }
}

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function shadow(ctx: Ctx, cx: number, cy: number, rw: number) {
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rw * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function unit(kind: UnitKind, f: Faction): HTMLCanvasElement {
  const [c, ctx] = canvas(16, 16);
  const t = PAL.team[f];
  // Beine
  r(ctx, 6, 12, 2, 3, PAL.woodDark);
  r(ctx, 9, 12, 2, 3, PAL.woodDark);
  if (kind === 'worker') {
    r(ctx, 5, 7, 6, 5, t.main);
    r(ctx, 5, 10, 6, 1, PAL.woodDark);
    r(ctx, 6, 3, 4, 4, PAL.skin);
    r(ctx, 6, 3, 4, 1, PAL.wood);
    r(ctx, 12, 4, 1, 8, PAL.wood);
    r(ctx, 10, 4, 4, 1, PAL.steel);
  } else if (kind === 'footman') {
    r(ctx, 5, 6, 6, 6, PAL.steelDark);
    r(ctx, 7, 6, 2, 6, t.main);
    r(ctx, 6, 4, 4, 2, PAL.skin);
    r(ctx, 6, 2, 4, 2, PAL.steel);
    r(ctx, 7, 1, 2, 1, t.light);
    r(ctx, 2, 7, 4, 5, t.dark);
    r(ctx, 3, 8, 2, 3, t.main);
    r(ctx, 12, 2, 1, 8, PAL.steel);
    r(ctx, 11, 9, 3, 1, PAL.wood);
  } else {
    r(ctx, 5, 6, 6, 6, t.dark);
    r(ctx, 6, 7, 4, 4, t.main);
    r(ctx, 6, 2, 4, 3, t.main);
    r(ctx, 7, 4, 2, 2, PAL.skin);
    r(ctx, 12, 3, 1, 1, PAL.wood);
    r(ctx, 13, 4, 1, 6, PAL.wood);
    r(ctx, 12, 10, 1, 1, PAL.wood);
    r(ctx, 12, 4, 1, 6, '#c9c2b0');
  }
  outline(ctx, 16, 16);
  return c;
}

function roof(ctx: Ctx, x: number, y: number, w: number, h: number, main: string, dark: string) {
  for (let i = 0; i < h; i++) {
    const inset = Math.floor(((h - i) / h) * (w * 0.18));
    r(ctx, x + inset, y + i, w - inset * 2, 1, i % 3 === 0 ? dark : main);
  }
  r(ctx, x + Math.floor(w * 0.18), y, w - Math.floor(w * 0.36), 1, dark);
}

function bricks(ctx: Ctx, x: number, y: number, w: number, h: number) {
  r(ctx, x, y, w, h, PAL.stone);
  for (let yy = y + 2; yy < y + h; yy += 3) {
    r(ctx, x, yy, w, 1, PAL.stoneDark);
    for (let xx = x + ((yy / 3) % 2 ? 1 : 4); xx < x + w; xx += 6) r(ctx, xx, yy - 2, 1, 2, PAL.stoneDark);
  }
}

function building(kind: BuildingKind, f: Faction): HTMLCanvasElement {
  const t = PAL.team[f];
  const S = { hall: 48, farm: 32, barracks: 48, tower: 32 }[kind];
  const [c, ctx] = canvas(S, S + 8);
  const o = 8; // Überhang nach oben (Dach/Turmspitze)
  shadow(ctx, S / 2 + 2, o + S - 4, S * 0.48);
  if (kind === 'hall') {
    bricks(ctx, 4, o + 18, 40, 24);
    roof(ctx, 1, o - 2, 46, 21, t.main, t.dark);
    r(ctx, 34, o - 6, 4, 8, PAL.stoneDark);
    r(ctx, 19, o + 28, 10, 14, PAL.woodDark);
    r(ctx, 20, o + 29, 8, 13, PAL.wood);
    r(ctx, 9, o + 25, 4, 5, '#e3c27a');
    r(ctx, 35, o + 25, 4, 5, '#e3c27a');
    r(ctx, 23, o + 3, 2, 10, PAL.woodDark);
    r(ctx, 25, o + 3, 6, 4, t.light);
  } else if (kind === 'farm') {
    r(ctx, 2, o + 20, 28, 10, '#5a4a2e');
    for (let x = 4; x < 30; x += 4) r(ctx, x, o + 21, 2, 8, '#8a7a3e');
    r(ctx, 6, o + 9, 20, 12, PAL.wood);
    for (let x = 7; x < 26; x += 3) r(ctx, x, o + 9, 1, 12, PAL.woodDark);
    roof(ctx, 3, o + 0, 26, 10, '#a88a4a', '#7e6634');
    r(ctx, 14, o + 14, 4, 7, PAL.woodDark);
    r(ctx, 24, o - 4, 1, 6, PAL.woodDark);
    r(ctx, 25, o - 4, 4, 3, t.main);
  } else if (kind === 'barracks') {
    bricks(ctx, 3, o + 20, 42, 22);
    r(ctx, 3, o + 20, 42, 2, PAL.wood);
    roof(ctx, 0, o + 2, 48, 19, t.dark, '#1f2328');
    r(ctx, 18, o + 30, 12, 12, PAL.woodDark);
    r(ctx, 19, o + 31, 10, 11, '#2a2018');
    r(ctx, 8, o + 26, 6, 4, PAL.steel);
    r(ctx, 34, o + 26, 6, 4, PAL.steel);
    r(ctx, 6, o - 6, 1, 10, PAL.woodDark);
    r(ctx, 7, o - 6, 5, 4, t.main);
    r(ctx, 40, o - 6, 1, 10, PAL.woodDark);
    r(ctx, 41, o - 6, 5, 4, t.main);
  } else {
    bricks(ctx, 8, o + 2, 16, 26);
    for (let x = 7; x < 25; x += 4) r(ctx, x, o - 2, 3, 4, PAL.stone);
    r(ctx, 7, o + 2, 18, 1, PAL.stoneDark);
    r(ctx, 15, o + 9, 2, 6, '#1d1f24');
    r(ctx, 11, o + 17, 10, 6, t.main);
    r(ctx, 11, o + 22, 10, 1, t.dark);
    r(ctx, 16, o - 8, 1, 6, PAL.woodDark);
    r(ctx, 17, o - 8, 4, 3, t.light);
  }
  outline(ctx, S, S + 8);
  return c;
}

function site(size: number): HTMLCanvasElement {
  const S = size * TILE;
  const [c, ctx] = canvas(S, S + 8);
  const o = 8;
  r(ctx, 2, o + 2, S - 4, S - 4, PAL.dirt);
  for (let i = 4; i < S - 4; i += 6) r(ctx, i, o + 4, 1, S - 8, PAL.wood);
  r(ctx, 3, o + 6, S - 6, 2, PAL.wood);
  r(ctx, 3, o + S - 10, S - 6, 2, PAL.wood);
  for (let i = 0; i < S - 8; i += 2) r(ctx, 4 + i, o + 6 + Math.floor(i * 0.6) % (S - 12), 2, 1, PAL.woodDark);
  outline(ctx, S, S + 8);
  return c;
}

function mine(): HTMLCanvasElement {
  const [c, ctx] = canvas(48, 56);
  const o = 8;
  shadow(ctx, 26, o + 44, 24);
  ctx.fillStyle = PAL.rock;
  ctx.beginPath();
  ctx.moveTo(2, o + 44);
  ctx.lineTo(10, o + 10);
  ctx.lineTo(24, o + 2);
  ctx.lineTo(38, o + 8);
  ctx.lineTo(46, o + 44);
  ctx.fill();
  r(ctx, 12, o + 12, 6, 3, PAL.rockLight);
  r(ctx, 26, o + 8, 8, 3, PAL.rockLight);
  r(ctx, 16, o + 26, 16, 18, '#121316');
  r(ctx, 15, o + 25, 18, 2, PAL.wood);
  r(ctx, 15, o + 25, 2, 19, PAL.wood);
  r(ctx, 31, o + 25, 2, 19, PAL.wood);
  for (const [x, y] of [[8, 30], [36, 22], [20, 16], [38, 36], [10, 40]]) {
    r(ctx, x, o + y, 3, 2, PAL.gold);
    r(ctx, x, o + y, 1, 1, '#f3d58a');
  }
  outline(ctx, 48, 56);
  return c;
}

function tree(seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(16, 22);
  const rnd = mulberry32(seed);
  shadow(ctx, 8, 20, 6);
  r(ctx, 7, 14, 2, 6, PAL.trunk);
  const cols = [PAL.treeDark, PAL.treeMid, PAL.treeLight];
  for (let layer = 0; layer < 3; layer++) {
    const y0 = 2 + layer * 4;
    const hw = 3 + layer * 1.6;
    for (let y = 0; y < 6; y++) {
      const w = Math.round(hw * (y / 5) + 1);
      r(ctx, 8 - w, y0 + y, w * 2, 1, cols[(layer + (y > 3 ? 0 : 1)) % 3]);
    }
  }
  for (let i = 0; i < 4; i++) r(ctx, 4 + Math.floor(rnd() * 8), 4 + Math.floor(rnd() * 10), 1, 1, PAL.treeLight);
  outline(ctx, 16, 22);
  return c;
}

/** Bäckt das Terrain (ohne Bäume) einmalig in eine Textur. */
export function bakeTerrain(scene: Phaser.Scene, grid: Grid, seed: number) {
  const [c, ctx] = canvas(grid.w * TILE, grid.h * TILE);
  const rnd = mulberry32(seed + 7);
  const isT = (x: number, y: number, t: string) => grid.inside(x, y) && grid.get(x, y) === t;
  for (let y = 0; y < grid.h; y++)
    for (let x = 0; x < grid.w; x++) {
      const px = x * TILE;
      const py = y * TILE;
      const t = grid.get(x, y);
      r(ctx, px, py, TILE, TILE, PAL.grass[Math.floor(rnd() * PAL.grass.length)]);
      for (let i = 0; i < 3; i++) r(ctx, px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 1, PAL.grassDot);
      if (t === 'water') {
        r(ctx, px, py, TILE, TILE, PAL.water);
        if (rnd() < 0.4) r(ctx, px + Math.floor(rnd() * 10), py + Math.floor(rnd() * 14), 4, 1, PAL.waterLight);
        if (!isT(x, y - 1, 'water')) r(ctx, px, py, TILE, 2, PAL.waterFoam);
        if (!isT(x - 1, y, 'water')) r(ctx, px, py, 1, TILE, PAL.waterFoam);
        if (!isT(x + 1, y, 'water')) r(ctx, px + 15, py, 1, TILE, PAL.waterFoam);
      } else if (t === 'rock') {
        r(ctx, px, py + 2, TILE, TILE - 2, PAL.rock);
        r(ctx, px + 2, py + 3, 6, 3, PAL.rockLight);
        r(ctx, px + 9, py + 9, 5, 2, PAL.rockLight);
        r(ctx, px, py + 13, TILE, 3, PAL.rockDark);
        if (!isT(x, y - 1, 'rock')) r(ctx, px, py + 1, TILE, 1, OUTLINE);
      }
    }
  add(scene, 'terrain', c);
}

export function buildTextures(scene: Phaser.Scene) {
  for (const f of ['player', 'enemy'] as Faction[]) {
    for (const k of ['worker', 'footman', 'archer'] as UnitKind[]) add(scene, `u_${k}_${f}`, unit(k, f));
    for (const k of ['hall', 'farm', 'barracks', 'tower'] as BuildingKind[]) add(scene, `b_${k}_${f}`, building(k, f));
  }
  add(scene, 'site2', site(2));
  add(scene, 'site3', site(3));
  add(scene, 'mine', mine());
  for (let i = 0; i < 4; i++) add(scene, `tree${i}`, tree(i * 31 + 3));
  const [p, pc] = canvas(2, 2);
  r(pc, 0, 0, 2, 2, '#ffffff');
  add(scene, 'px', p);
  const [g, gc] = canvas(4, 4);
  r(gc, 0, 0, 4, 4, PAL.gold);
  r(gc, 0, 0, 2, 2, '#f3d58a');
  add(scene, 'carry_gold', g);
  const [w, wc] = canvas(5, 3);
  r(wc, 0, 0, 5, 3, PAL.wood);
  r(wc, 0, 0, 5, 1, '#8a6a45');
  add(scene, 'carry_wood', w);
}
