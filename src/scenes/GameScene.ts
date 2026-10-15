import * as Phaser from 'phaser';
import { BUILDINGS, BuildingKind, Difficulty, hex, PAL, TILE, UNITS } from '@/config';
import { bakeTerrain, buildTextures } from '@/gfx/Textures';
import { World } from '@/world/World';
import { EnemyAI } from '@/world/AI';
import { Building, Mine, Unit } from '@/world/Entities';
import { buzz, sfx } from '@/audio/Sfx';

export type Selection = { units: Unit[] } | { building: Building } | null;

interface Ptr {
  sx: number;
  sy: number;
  x: number;
  y: number;
}

export interface SceneHooks {
  onSelection: () => void;
  onPlacement: () => void;
}

/** Darstellung, Eingabe und Auswahl. Die Simulation lebt in World. */
export class GameScene extends Phaser.Scene {
  world!: World;
  ai!: EnemyAI;
  selection: Selection = null;
  placing: { kind: BuildingKind; tx: number; ty: number } | null = null;
  paused = false;
  speed = 1;
  hooks: SceneHooks = { onSelection: () => {}, onPlacement: () => {} };

  private under!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private fogCanvas!: Phaser.Textures.CanvasTexture;
  private fogIn = 0;
  private ptrs = new Map<number, Ptr>();
  private mode: 'none' | 'pending' | 'pan' | 'lasso' | 'pinch' = 'none';
  private pressTimer?: Phaser.Time.TimerEvent;
  private pinch = { d0: 1, z0: 1 };
  private lasso: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private lastTap = { t: 0, kind: '' };

  constructor() {
    super('game');
  }

  create(data: { difficulty: Difficulty; seed: number }) {
    this.selection = null;
    this.placing = null;
    this.paused = false;
    this.speed = 1;
    this.ptrs.clear();
    this.mode = 'none';
    this.lasso = null;
    if (this.textures.exists('fog')) this.textures.remove('fog');
    buildTextures(this);
    this.world = new World(this, data.seed);
    bakeTerrain(this, this.world.grid, data.seed);
    this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(-10);
    this.world.setup();
    this.ai = new EnemyAI(this.world, data.difficulty);
    this.world.on('died', () => this.pruneSelection());

    this.under = this.add.graphics().setDepth(-5);
    this.over = this.add.graphics().setDepth(60000);
    this.setupFog();
    this.setupCamera();
    this.setupInput();
    GameScene.onReady?.(this);
  }

  static onReady?: (s: GameScene) => void;

  // ───────────────────────── Kamera ─────────────────────────

  private setupCamera() {
    const cam = this.cameras.main;
    const W = this.world.grid.w * TILE;
    const H = this.world.grid.h * TILE;
    cam.setBackgroundColor(PAL.bg);
    cam.setBounds(-TILE * 3, -TILE * 4, W + TILE * 6, H + TILE * 9);
    cam.setRoundPixels(false);
    cam.setZoom(this.defaultZoom());
    const hall = this.world.buildings.find((b) => b.faction === 'player');
    if (hall) cam.centerOn(hall.x + TILE * 2, hall.y - TILE);
    this.scale.on('resize', () => cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZoom(), 6)));
  }

  private defaultZoom() {
    const { width, height } = this.scale;
    return Phaser.Math.Clamp(Math.min(width, height) / (11 * TILE), this.minZoom(), 4);
  }
  private minZoom() {
    const { width, height } = this.scale;
    return Math.max(width / ((this.world.grid.w + 6) * TILE), height / ((this.world.grid.h + 9) * TILE), 0.8);
  }

  toWorld(sx: number, sy: number) {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom,
    };
  }

  /** Zoom so, dass der Weltpunkt unter (sx,sy) dort bleibt. */
  private zoomAt(z: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    const wp = this.toWorld(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(z, this.minZoom(), 6));
    cam.scrollX = wp.x - cam.width / 2 - (sx - cam.width / 2) / cam.zoom;
    cam.scrollY = wp.y - cam.height / 2 - (sy - cam.height / 2) / cam.zoom;
  }

  centerOn(x: number, y: number) {
    this.cameras.main.centerOn(x, y);
  }

  // ───────────────────────── Eingabe ─────────────────────────

  private setupInput() {
    this.input.addPointer(2);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(this.cameras.main.zoom * (dy > 0 ? 0.88 : 1.14), p.x, p.y);
    });
  }

  private down(p: Phaser.Input.Pointer) {
    if (this.paused) return;
    this.ptrs.set(p.id, { sx: p.x, sy: p.y, x: p.x, y: p.y });
    this.pressTimer?.remove();
    if (this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      this.mode = 'pinch';
      this.lasso = null;
      this.pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.cameras.main.zoom };
      return;
    }
    if (p.rightButtonDown()) {
      const w = this.toWorld(p.x, p.y);
      this.command(w.x, w.y);
      this.mode = 'none';
      return;
    }
    this.mode = 'pending';
    // Lange drücken → Auswahlrahmen
    this.pressTimer = this.time.delayedCall(320, () => {
      if (this.mode !== 'pending' || this.placing) return;
      this.mode = 'lasso';
      const w = this.toWorld(p.x, p.y);
      this.lasso = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      buzz(12);
    });
  }

  private move(p: Phaser.Input.Pointer) {
    const ptr = this.ptrs.get(p.id);
    if (!ptr || this.paused) return;
    const dx = p.x - ptr.x;
    const dy = p.y - ptr.y;
    ptr.x = p.x;
    ptr.y = p.y;
    const cam = this.cameras.main;
    if (this.mode === 'pending' && Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > 10) this.mode = 'pan';
    if (this.mode === 'pan') {
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
    } else if (this.mode === 'lasso' && this.lasso) {
      const w = this.toWorld(p.x, p.y);
      this.lasso.x1 = w.x;
      this.lasso.y1 = w.y;
    } else if (this.mode === 'pinch' && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.zoomAt(this.pinch.z0 * (d / this.pinch.d0), mx, my);
      cam.scrollX -= dx / 2 / cam.zoom;
      cam.scrollY -= dy / 2 / cam.zoom;
    }
  }

  private up(p: Phaser.Input.Pointer) {
    if (!this.ptrs.has(p.id)) return;
    this.ptrs.delete(p.id);
    this.pressTimer?.remove();
    if (this.mode === 'pinch') {
      // Restfinger soll nicht als Tap zählen
      this.mode = this.ptrs.size ? 'pan' : 'none';
      return;
    }
    if (this.mode === 'pending') {
      const w = this.toWorld(p.x, p.y);
      this.tap(w.x, w.y);
    } else if (this.mode === 'lasso' && this.lasso) {
      this.boxSelect(this.lasso);
      this.lasso = null;
    }
    this.mode = 'none';
  }

  // ───────────────────────── Auswahl & Befehle ─────────────────────────

  private hitUnit(x: number, y: number) {
    const r = Math.max(9, 20 / this.cameras.main.zoom);
    let best: Unit | null = null;
    let bd = r;
    for (const u of this.world.units) {
      if (u.faction === 'enemy' && !this.world.isVisible(u.x, u.y)) continue;
      const d = Math.hypot(u.x - x, u.y - 5 - y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  private hitBuilding(x: number, y: number) {
    return this.world.buildings.find((b) => {
      if (b.faction === 'enemy' && !this.world.isExplored(b.tx, b.ty)) return false;
      const x0 = b.tx * TILE;
      const y0 = b.ty * TILE - 6;
      return x >= x0 && x < x0 + b.size * TILE && y >= y0 && y < y0 + b.size * TILE + 6;
    });
  }

  private hitMine(x: number, y: number): Mine | undefined {
    return this.world.mines.find((m) => x >= m.tx * TILE && x < (m.tx + 3) * TILE && y >= m.ty * TILE - 6 && y < (m.ty + 3) * TILE);
  }

  get selectedUnits(): Unit[] {
    return this.selection && 'units' in this.selection ? this.selection.units : [];
  }
  get selectedBuilding(): Building | null {
    return this.selection && 'building' in this.selection ? this.selection.building : null;
  }

  select(s: Selection) {
    this.selection = s && 'units' in s && !s.units.length ? null : s;
    if (this.selection) sfx.play('select');
    this.hooks.onSelection();
  }

  private tap(x: number, y: number) {
    if (this.placing) {
      const s = BUILDINGS[this.placing.kind].size;
      this.placing.tx = Math.floor(x / TILE - s / 2 + 0.5);
      this.placing.ty = Math.floor(y / TILE - s / 2 + 0.5);
      this.hooks.onPlacement();
      return;
    }
    const u = this.hitUnit(x, y);
    if (u && u.faction === 'player') {
      const now = this.time.now;
      if (now - this.lastTap.t < 380 && this.lastTap.kind === u.kind) {
        // Doppeltipp: alle Einheiten dieses Typs im Bild
        const view = this.cameras.main.worldView;
        this.select({ units: this.world.units.filter((o) => o.faction === 'player' && o.kind === u.kind && view.contains(o.x, o.y)) });
        this.lastTap.t = 0;
      } else {
        this.select({ units: [u] });
        this.lastTap = { t: now, kind: u.kind };
      }
      return;
    }
    const b = this.hitBuilding(x, y);
    if (b && b.faction === 'player') {
      const workers = this.selectedUnits.filter((w) => w.kind === 'worker');
      if (workers.length && !b.built) {
        workers.forEach((w) => this.world.assist(w, b));
        this.ack(b.x, b.y, PAL.gold);
      } else if (workers.length && b.kind === 'hall' && workers.some((w) => w.carry)) {
        workers.forEach((w) => this.world.returnCargo(w));
        this.ack(b.x, b.y, PAL.gold);
      } else this.select({ building: b });
      return;
    }
    this.command(x, y, u ?? b ?? null);
  }

  /** Kontextbefehl an die aktuelle Auswahl. */
  command(x: number, y: number, target: Unit | Building | null = this.hitUnit(x, y) ?? this.hitBuilding(x, y) ?? null) {
    const units = this.selectedUnits;
    const sb = this.selectedBuilding;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const g = this.world.grid;
    if (sb) {
      if (sb.stats.trains.length && g.inside(tx, ty)) {
        sb.rally = { x: tx, y: ty };
        this.ack(x, y, PAL.team.player.light);
      }
      return;
    }
    if (!units.length) return;
    if (target && target.faction === 'enemy') {
      this.world.commandAttack(units, target);
      this.ack(target.x, target.y, PAL.team.enemy.light);
      return;
    }
    const workers = units.filter((u) => u.kind === 'worker');
    const others = units.filter((u) => u.kind !== 'worker');
    const mine = this.hitMine(x, y);
    if (mine && workers.length) {
      workers.forEach((w) => this.world.gatherMine(w, mine));
      if (others.length) this.world.commandMove(others, tx, ty, true);
      this.ack(mine.x, mine.y, PAL.gold);
      return;
    }
    if (g.inside(tx, ty) && g.get(tx, ty) === 'tree' && workers.length) {
      workers.forEach((w) => this.world.gatherTree(w, { x: tx, y: ty }));
      if (others.length) this.world.commandMove(others, tx, ty, true);
      this.ack((tx + 0.5) * TILE, (ty + 0.5) * TILE, '#b5925f');
      return;
    }
    this.world.commandMove(units, tx, ty, true);
    this.ack(x, y, PAL.team.player.light);
  }

  private ack(x: number, y: number, color: string) {
    this.world.fx.ping(x, y, color);
    sfx.play('command');
    buzz(8);
  }

  private boxSelect(l: { x0: number; y0: number; x1: number; y1: number }) {
    const rect = new Phaser.Geom.Rectangle(Math.min(l.x0, l.x1), Math.min(l.y0, l.y1), Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0));
    let units = this.world.units.filter((u) => u.faction === 'player' && rect.contains(u.x, u.y));
    if (units.some((u) => u.military)) units = units.filter((u) => u.military);
    this.select({ units });
  }

  pruneSelection() {
    const s = this.selection;
    if (!s) return;
    if ('units' in s) {
      const alive = s.units.filter((u) => u.alive);
      if (alive.length !== s.units.length) {
        this.selection = alive.length ? { units: alive } : null;
        this.hooks.onSelection();
      }
    } else if (!s.building.alive) {
      this.selection = null;
      this.hooks.onSelection();
    }
  }

  // ───────────────────────── Bauplatzierung ─────────────────────────

  startPlacing(kind: BuildingKind) {
    const c = this.toWorld(this.scale.width / 2, this.scale.height / 2);
    const s = BUILDINGS[kind].size;
    this.placing = { kind, tx: Math.floor(c.x / TILE - s / 2 + 0.5), ty: Math.floor(c.y / TILE - s / 2 + 0.5) };
    this.hooks.onPlacement();
  }

  confirmPlacing() {
    const p = this.placing;
    if (!p) return;
    const workers = this.selectedUnits.filter((u) => u.kind === 'worker');
    if (!workers.length) return this.cancelPlacing();
    // Nächster Arbeiter baut, Rest arbeitet weiter
    const s = BUILDINGS[p.kind].size;
    const cx = (p.tx + s / 2) * TILE;
    const cy = (p.ty + s / 2) * TILE;
    workers.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const site = this.world.build([workers[0]], p.kind, p.tx, p.ty);
    if (!site) return;
    this.ack(cx, cy, PAL.gold);
    this.placing = null;
    this.hooks.onPlacement();
  }

  cancelPlacing() {
    this.placing = null;
    this.hooks.onPlacement();
  }

  // ───────────────────────── Nebel ─────────────────────────

  private setupFog() {
    const g = this.world.grid;
    this.fogCanvas = this.textures.createCanvas('fog', g.w, g.h) as Phaser.Textures.CanvasTexture;
    this.fogCanvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, 'fog').setOrigin(0).setScale(TILE).setDepth(70000);
  }

  private drawFog() {
    const g = this.world.grid;
    const ctx = this.fogCanvas.getContext();
    const img = ctx.createImageData(g.w, g.h);
    const fc = hex(PAL.fog);
    for (let i = 0; i < this.world.vis.length; i++) {
      const v = this.world.vis[i];
      img.data[i * 4] = (fc >> 16) & 255;
      img.data[i * 4 + 1] = (fc >> 8) & 255;
      img.data[i * 4 + 2] = fc & 255;
      img.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 140 : 255;
    }
    ctx.putImageData(img, 0, 0);
    this.fogCanvas.refresh();
  }

  // ───────────────────────── Frame ─────────────────────────

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    if (!this.paused) {
      // 2× = zwei Simulationsschritte pro Frame (stabiler als großes dt)
      for (let i = 0; i < this.speed; i++) {
        this.world.update(dt);
        this.ai.update(dt);
      }
    }
    this.syncSprites();
    this.drawOverlays();
    this.fogIn -= dt;
    if (this.fogIn <= 0) {
      this.fogIn = 0.2;
      this.drawFog();
    }
  }

  private syncSprites() {
    const w = this.world;
    const t = this.time.now / 1000;
    for (const u of w.units) {
      const vis = u.faction === 'player' || w.isVisible(u.x, u.y);
      const bob = u.moving ? -Math.abs(Math.sin(t * 14 + u.id)) * 1.5 : 0;
      const dir = u.sprite.flipX ? -1 : 1;
      u.sprite
        .setPosition(Math.round(u.x + (u.lunge > 0 ? dir * 2 : 0)), Math.round(u.y + bob))
        .setDepth(u.y)
        .setVisible(vis);
      if (u.flash > 0) u.sprite.setTintFill(0xffffff);
      else u.sprite.clearTint();
      u.carryIcon.setVisible(vis && !!u.carry);
      if (u.carry) u.carryIcon.setTexture(`carry_${u.carry.res}`).setPosition(Math.round(u.x + dir * 4), Math.round(u.y - 6 + bob)).setDepth(u.y + 1);
    }
    for (const b of w.buildings) {
      b.sprite.setVisible(b.faction === 'player' || w.isExplored(b.tx, b.ty));
      if (b.flash > 0) b.sprite.setTintFill(0xffffff);
      else b.sprite.clearTint();
    }
  }

  private drawOverlays() {
    const u = this.under;
    const o = this.over;
    u.clear();
    o.clear();
    const w = this.world;
    const selU = new Set(this.selectedUnits);
    const sb = this.selectedBuilding;

    for (const s of selU) {
      u.lineStyle(1, hex(PAL.team.player.light), 1);
      u.strokeEllipse(s.x, s.y + 1, 12, 6);
    }
    if (sb) {
      u.lineStyle(1, hex(PAL.team.player.light), 1);
      u.strokeRect(sb.tx * TILE - 1, sb.ty * TILE - 1, sb.size * TILE + 2, sb.size * TILE + 2);
      if (sb.rally) {
        const rx = (sb.rally.x + 0.5) * TILE;
        const ry = (sb.rally.y + 0.5) * TILE;
        o.lineStyle(1, hex(PAL.team.player.light), 0.5);
        o.lineBetween(sb.x, sb.y, rx, ry);
        o.fillStyle(hex(PAL.team.player.light), 1);
        o.fillRect(rx, ry - 8, 1, 8);
        o.fillRect(rx + 1, ry - 8, 4, 3);
      }
    }

    // Lebensbalken: ausgewählt oder beschädigt
    for (const x of w.units) {
      if (!(selU.has(x) || x.hp < x.maxHp)) continue;
      if (x.faction === 'enemy' && !w.isVisible(x.x, x.y)) continue;
      this.bar(o, x.x - 6, x.y - 15, 12, x.hp / x.maxHp, x.faction);
    }
    for (const b of w.buildings) {
      if (b.faction === 'enemy' && !w.isVisible(b.x, b.y)) continue;
      const bw = b.size * TILE - 6;
      const bx = b.tx * TILE + 3;
      const by = b.ty * TILE - 10;
      if (!b.built) this.bar(o, bx, by, bw, b.progress, 'build');
      else if (b === sb || b.hp < b.maxHp) this.bar(o, bx, by, bw, b.hp / b.maxHp, b.faction);
      if (b.built && b.queue.length && b.faction === 'player') {
        this.bar(o, bx, by + 3, bw, b.trainT / UNITS[b.queue[0]].time, 'build');
      }
    }

    if (this.lasso) {
      const l = this.lasso;
      o.lineStyle(1, hex(PAL.team.player.light), 0.9);
      o.fillStyle(hex(PAL.team.player.light), 0.12);
      o.fillRect(Math.min(l.x0, l.x1), Math.min(l.y0, l.y1), Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0));
      o.strokeRect(Math.min(l.x0, l.x1), Math.min(l.y0, l.y1), Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0));
    }

    if (this.placing) {
      const p = this.placing;
      const s = BUILDINGS[p.kind].size;
      const ok = w.canPlace(p.kind, p.tx, p.ty);
      for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++) {
          const free = w.grid.walkable(p.tx + dx, p.ty + dy);
          o.fillStyle(free && ok ? 0x7fd38a : 0xd9534f, 0.35);
          o.fillRect((p.tx + dx) * TILE + 1, (p.ty + dy) * TILE + 1, TILE - 2, TILE - 2);
        }
      o.lineStyle(1, ok ? 0x7fd38a : 0xd9534f, 1);
      o.strokeRect(p.tx * TILE, p.ty * TILE, s * TILE, s * TILE);
    }
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, frac: number, kind: 'player' | 'enemy' | 'build') {
    const f = Phaser.Math.Clamp(frac, 0, 1);
    g.fillStyle(0x0b0d10, 0.85);
    g.fillRect(x - 1, y - 1, w + 2, 4);
    const c = kind === 'build' ? hex(PAL.gold) : kind === 'enemy' ? hex(PAL.team.enemy.light) : f > 0.5 ? 0x7fbf6a : f > 0.25 ? 0xd6a443 : 0xc8553d;
    g.fillStyle(c, 1);
    g.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
  }
}
