import * as Phaser from 'phaser';
import { BUILDINGS, BuildingKind, BuildingStats, Faction, GATHER, TILE, UNITS, UnitKind, UnitStats, UpgradeKey } from '@/config';
import type { Point } from '@/world/Grid';

let nextId = 1;
export const newId = () => nextId++;

export type Order =
  | { type: 'idle' }
  | { type: 'move'; tx: number; ty: number; attack: boolean }
  | { type: 'attack'; target: Target; resume?: Order }
  | { type: 'gather'; res: 'gold'; mine: Mine; phase: 'to' | 'work' | 'back'; timer: number }
  | { type: 'gather'; res: 'wood'; tree: Point; phase: 'to' | 'work' | 'back'; timer: number }
  | { type: 'build'; site: Building; resume?: Order };

export type Target = Unit | Building;

export class Unit {
  readonly id = newId();
  readonly stats: UnitStats;
  hp: number;
  x: number;
  y: number;
  order: Order = { type: 'idle' };
  path: Point[] = [];
  pathFor = ''; // Schlüssel des Ziels, für das der Pfad berechnet wurde
  repathIn = 0;
  cooldown = 0;
  scanIn = Math.random() * 0.3;
  carry: { res: 'gold' | 'wood'; amount: number } | null = null;
  moving = false;
  lunge = 0;
  flash = 0;
  readonly sprite: Phaser.GameObjects.Image;
  readonly carryIcon: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly kind: UnitKind,
    readonly faction: Faction,
    x: number,
    y: number,
  ) {
    this.stats = UNITS[kind];
    this.hp = this.stats.hp;
    this.x = x;
    this.y = y;
    this.sprite = scene.add.image(x, y, `u_${kind}_${faction}`).setOrigin(0.5, 0.85);
    this.carryIcon = scene.add.image(x, y, 'carry_gold').setVisible(false);
  }

  get alive() {
    return this.hp > 0;
  }
  get tx() {
    return Math.floor(this.x / TILE);
  }
  get ty() {
    return Math.floor(this.y / TILE);
  }
  get military() {
    return this.kind !== 'worker';
  }
  get maxHp() {
    return this.stats.hp;
  }
}

export class Building {
  readonly id = newId();
  readonly stats: BuildingStats;
  hp: number;
  built: boolean;
  progress = 0;
  queue: UnitKind[] = [];
  research: { key: UpgradeKey; t: number } | null = null;
  trainT = 0;
  cooldown = 0;
  rally: Point | null = null;
  flash = 0;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly kind: BuildingKind,
    readonly faction: Faction,
    readonly tx: number,
    readonly ty: number,
    built: boolean,
  ) {
    this.stats = BUILDINGS[kind];
    this.built = built;
    this.hp = built ? this.stats.hp : Math.ceil(this.stats.hp * 0.1);
    this.sprite = scene.add
      .image(tx * TILE, (ty + this.size) * TILE, built ? this.tex : `site${this.size}`)
      .setOrigin(0, 1)
      .setDepth((ty + this.size) * TILE);
  }

  get tex() {
    return `b_${this.kind}_${this.faction}`;
  }
  get size() {
    return this.stats.size;
  }
  get alive() {
    return this.hp > 0;
  }
  get maxHp() {
    return this.stats.hp;
  }
  get x() {
    return (this.tx + this.size / 2) * TILE;
  }
  get y() {
    return (this.ty + this.size / 2) * TILE;
  }
}

export class Mine {
  readonly id = newId();
  gold = GATHER.mineGold;
  readonly size = 3;
  readonly sprite: Phaser.GameObjects.Image;
  constructor(
    scene: Phaser.Scene,
    readonly tx: number,
    readonly ty: number,
  ) {
    this.sprite = scene.add
      .image(tx * TILE, (ty + 3) * TILE, 'mine')
      .setOrigin(0, 1)
      .setDepth((ty + 3) * TILE);
  }
  get x() {
    return (this.tx + 1.5) * TILE;
  }
  get y() {
    return (this.ty + 1.5) * TILE;
  }
}

/** Abstand Punkt → Rechteck eines Gebäudes/einer Mine in Pixeln. */
export function distToRect(px: number, py: number, o: { tx: number; ty: number; size: number }) {
  const x0 = o.tx * TILE;
  const y0 = o.ty * TILE;
  const x1 = x0 + o.size * TILE;
  const y1 = y0 + o.size * TILE;
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

export function distTo(u: { x: number; y: number }, t: Target) {
  return t instanceof Building ? distToRect(u.x, u.y, t) : Math.max(0, Math.hypot(t.x - u.x, t.y - u.y) - 8);
}
