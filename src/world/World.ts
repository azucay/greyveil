import * as Phaser from 'phaser';
import { BUILDINGS, BuildingKind, Cost, Faction, GATHER, MAX_POP, PAL, START, TILE, UNITS, UnitKind } from '@/config';
import { Grid, Point } from '@/world/Grid';
import { Building, distTo, distToRect, Mine, Order, Target, Unit } from '@/world/Entities';
import { Fx } from '@/gfx/Fx';
import { buzz, sfx, SfxName } from '@/audio/Sfx';

type Res = { gold: number; wood: number };

export interface WorldEvents {
  res: () => void;
  msg: (text: string) => void;
  over: (won: boolean) => void;
  attacked: (x: number, y: number) => void;
  died: (t: Target) => void;
}

const enemyOf = (f: Faction): Faction => (f === 'player' ? 'enemy' : 'player');

/** Die gesamte Spielsimulation: Einheiten, Gebäude, Ressourcen, Kampf, Sicht. */
export class World {
  readonly grid = new Grid();
  readonly fx: Fx;
  units: Unit[] = [];
  buildings: Building[] = [];
  mines: Mine[] = [];
  trees = new Map<number, Phaser.GameObjects.Image>();
  res: Record<Faction, Res> = { player: { gold: START.gold, wood: START.wood }, enemy: { gold: START.gold, wood: START.wood } };
  gatherMul: Record<Faction, number> = { player: 1, enemy: 1 };
  /** Sicht des Spielers: 0 unerforscht, 1 erforscht, 2 sichtbar. */
  vis: Uint8Array;
  time = 0;
  over = false;
  private visIn = 0;
  private lastAlert = -99;
  private listeners: { [K in keyof WorldEvents]?: WorldEvents[K][] } = {};

  constructor(
    readonly scene: Phaser.Scene,
    seed: number,
  ) {
    this.fx = new Fx(scene);
    this.grid.generate(seed);
    this.vis = new Uint8Array(this.grid.w * this.grid.h);
  }

  on<K extends keyof WorldEvents>(k: K, fn: WorldEvents[K]) {
    ((this.listeners[k] ??= []) as WorldEvents[K][]).push(fn);
  }
  emit<K extends keyof WorldEvents>(k: K, ...a: Parameters<WorldEvents[K]>) {
    for (const fn of this.listeners[k] ?? []) (fn as (...x: Parameters<WorldEvents[K]>) => void)(...a);
  }
  sound(name: SfxName, x?: number, y?: number) {
    if (x === undefined || y === undefined || this.isVisible(x, y)) sfx.play(name);
  }

  // ───────────────────────── Setup ─────────────────────────

  setup() {
    const [pb, eb] = this.grid.bases();
    this.spawnTrees();
    // Minen: eine je Basis + zwei umkämpfte in der Mitte
    for (const b of [pb, eb]) {
      const towards = { x: b.x + (b.x < this.grid.w / 2 ? 7 : -5), y: b.y + (b.y < this.grid.h / 2 ? -1 : 1) };
      this.addMine(towards, b);
    }
    this.addMine({ x: Math.floor(this.grid.w * 0.3), y: Math.floor(this.grid.h * 0.3) });
    this.addMine({ x: Math.floor(this.grid.w * 0.65), y: Math.floor(this.grid.h * 0.65) });
    for (const [f, b] of [['player', pb], ['enemy', eb]] as [Faction, Point][]) {
      this.addBuilding('hall', f, b.x, b.y, true);
      const hall = this.buildings[this.buildings.length - 1];
      for (let i = 0; i < START.workers; i++) this.sendToRally(this.spawnNear(hall, 'worker'), hall);
    }
    this.updateVision();
  }

  private spawnTrees() {
    for (let y = 0; y < this.grid.h; y++)
      for (let x = 0; x < this.grid.w; x++) if (this.grid.get(x, y) === 'tree') this.addTreeSprite(x, y);
  }

  private addTreeSprite(x: number, y: number) {
    const img = this.scene.add
      .image(x * TILE + 8 + ((x * 7 + y * 3) % 3) - 1, (y + 1) * TILE + 2, `tree${(x * 13 + y * 7) % 4}`)
      .setOrigin(0.5, 1)
      .setDepth((y + 1) * TILE);
    this.trees.set(this.grid.idx(x, y), img);
  }

  /** Mine mit mindestens 3 Tiles Abstand zum Rathaus (Laufwege = Spieltempo). */
  private addMine(near: Point, hall?: Point) {
    const far = (p: Point) => !hall || Math.max(Math.abs(p.x + 1 - (hall.x + 1)), Math.abs(p.y + 1 - (hall.y + 1))) >= 6;
    const p = this.grid.findFree(near, 3, 1, 0, 14, far);
    if (!p) return;
    const m = new Mine(this.scene, p.x, p.y);
    this.grid.setOcc(p.x, p.y, 3, m.id);
    this.mines.push(m);
  }

  addBuilding(kind: BuildingKind, f: Faction, tx: number, ty: number, built: boolean) {
    const b = new Building(this.scene, kind, f, tx, ty, built);
    this.grid.setOcc(tx, ty, b.size, b.id);
    this.buildings.push(b);
    this.emit('res');
    return b;
  }

  spawnNear(b: Building, kind: UnitKind) {
    const p = this.freeTileAround(b.tx, b.ty, b.size, b.rally ?? { x: b.tx + b.size, y: b.ty + b.size });
    const u = new Unit(this.scene, kind, b.faction, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
    this.units.push(u);
    this.emit('res');
    return u;
  }

  private freeTileAround(tx: number, ty: number, size: number, towards: Point): Point {
    let best: Point = { x: tx + size, y: ty + size };
    let bd = Infinity;
    for (let ring = 0; ring < 4; ring++)
      for (let y = ty - 1 - ring; y <= ty + size + ring; y++)
        for (let x = tx - 1 - ring; x <= tx + size + ring; x++) {
          if (!this.grid.walkable(x, y)) continue;
          const crowd = this.units.filter((u) => u.tx === x && u.ty === y).length * 3;
          const d = Math.hypot(x - towards.x, y - towards.y) + crowd + ring * 4;
          if (d < bd) {
            bd = d;
            best = { x, y };
          }
        }
    return best;
  }

  // ───────────────────────── Wirtschaft ─────────────────────────

  pop(f: Faction) {
    return this.units.filter((u) => u.faction === f).length + this.buildings.filter((b) => b.faction === f).reduce((s, b) => s + b.queue.length, 0);
  }
  cap(f: Faction) {
    return Math.min(MAX_POP, this.buildings.filter((b) => b.faction === f && b.built).reduce((s, b) => s + b.stats.supply, 0));
  }
  canAfford(f: Faction, c: Cost) {
    return this.res[f].gold >= c.gold && this.res[f].wood >= c.wood;
  }
  private pay(f: Faction, c: Cost, sign = 1) {
    this.res[f].gold -= c.gold * sign;
    this.res[f].wood -= c.wood * sign;
    this.emit('res');
  }

  private fail(f: Faction, text: string) {
    if (f !== 'player') return false;
    this.emit('msg', text);
    sfx.play('error');
    buzz(30);
    return false;
  }

  train(b: Building, kind: UnitKind): boolean {
    const st = UNITS[kind];
    if (!b.built || !b.stats.trains.includes(kind)) return false;
    if (b.queue.length >= 5) return this.fail(b.faction, 'Warteschlange voll');
    if (!this.canAfford(b.faction, st.cost)) return this.fail(b.faction, 'Nicht genug Ressourcen');
    if (this.pop(b.faction) >= this.cap(b.faction)) return this.fail(b.faction, 'Mehr Farmen nötig');
    this.pay(b.faction, st.cost);
    b.queue.push(kind);
    return true;
  }

  cancelTrain(b: Building) {
    const k = b.queue.pop();
    if (!k) return;
    if (!b.queue.length) b.trainT = 0;
    this.pay(b.faction, UNITS[k].cost, -1);
  }

  canPlace(kind: BuildingKind, tx: number, ty: number) {
    const s = BUILDINGS[kind].size;
    if (!this.grid.buildable(tx, ty, s)) return false;
    // Keine Einheiten auf der Baufläche einklemmen (eigene dürfen weggehen)
    if (kind === 'hall')
      for (const m of this.mines) if (distToRect((tx + 1.5) * TILE, (ty + 1.5) * TILE, m) < 3 * TILE) return false;
    return true;
  }

  /** Legt eine Baustelle an und schickt die Arbeiter hin. */
  build(workers: Unit[], kind: BuildingKind, tx: number, ty: number): Building | null {
    const f = workers[0]?.faction;
    if (!f) return null;
    const st = BUILDINGS[kind];
    if (!this.canAfford(f, st.cost)) return (this.fail(f, 'Nicht genug Ressourcen'), null);
    if (!this.canPlace(kind, tx, ty)) return (this.fail(f, 'Hier kann nicht gebaut werden'), null);
    this.pay(f, st.cost);
    const site = this.addBuilding(kind, f, tx, ty, false);
    this.pushOut(site);
    for (const w of workers) this.assist(w, site);
    return site;
  }

  assist(w: Unit, site: Building) {
    const prev = w.order.type === 'gather' ? w.order : undefined;
    this.setOrder(w, { type: 'build', site, resume: prev });
  }

  /** Einheiten, die auf einer neuen Baufläche stehen, zur Seite schieben. */
  private pushOut(b: Building) {
    for (const u of this.units) {
      if (u.tx >= b.tx && u.tx < b.tx + b.size && u.ty >= b.ty && u.ty < b.ty + b.size) {
        const p = this.freeTileAround(b.tx, b.ty, b.size, { x: u.tx, y: u.ty });
        u.x = (p.x + 0.5) * TILE;
        u.y = (p.y + 0.5) * TILE;
        u.path = [];
        u.pathFor = '';
      }
    }
  }

  // ───────────────────────── Befehle ─────────────────────────

  setOrder(u: Unit, o: Order) {
    u.order = o;
    u.path = [];
    u.pathFor = '';
    u.repathIn = 0;
  }

  /** Formation: Ziele um den Zielpunkt herum verteilen. */
  commandMove(units: Unit[], tx: number, ty: number, attack: boolean) {
    const spots = this.spotsAround(tx, ty, units.length);
    units.forEach((u, i) => {
      this.setOrder(u, { type: 'move', tx: spots[i].x, ty: spots[i].y, attack: attack && u.military });
    });
  }

  private spotsAround(tx: number, ty: number, n: number): Point[] {
    const out: Point[] = [];
    for (let r = 0; out.length < n && r < 8; r++)
      for (let dy = -r; dy <= r && out.length < n; dy++)
        for (let dx = -r; dx <= r && out.length < n; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.grid.walkable(tx + dx, ty + dy)) out.push({ x: tx + dx, y: ty + dy });
        }
    while (out.length < n) out.push({ x: tx, y: ty });
    return out;
  }

  commandAttack(units: Unit[], t: Target) {
    for (const u of units) this.setOrder(u, { type: 'attack', target: t });
  }

  gatherMine(u: Unit, mine: Mine) {
    this.setOrder(u, { type: 'gather', res: 'gold', mine, phase: u.carry?.res === 'gold' ? 'back' : 'to', timer: 0 });
  }
  gatherTree(u: Unit, tree: Point) {
    this.setOrder(u, { type: 'gather', res: 'wood', tree, phase: u.carry?.res === 'wood' ? 'back' : 'to', timer: 0 });
  }
  returnCargo(u: Unit) {
    if (!u.carry) return;
    const nearestMine = this.nearestMine(u);
    if (u.carry.res === 'gold' && nearestMine) this.setOrder(u, { type: 'gather', res: 'gold', mine: nearestMine, phase: 'back', timer: 0 });
    else if (u.carry.res === 'wood') this.setOrder(u, { type: 'gather', res: 'wood', tree: this.grid.nearestTree({ x: u.tx, y: u.ty }) ?? { x: u.tx, y: u.ty }, phase: 'back', timer: 0 });
  }

  nearestMine(from: { x: number; y: number }) {
    let best: Mine | null = null;
    let bd = Infinity;
    for (const m of this.mines) {
      const d = Math.hypot(m.x - from.x, m.y - from.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  nearestHall(u: Unit) {
    let best: Building | null = null;
    let bd = Infinity;
    for (const b of this.buildings) {
      if (b.faction !== u.faction || b.kind !== 'hall' || !b.built) continue;
      const d = distToRect(u.x, u.y, b);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // ───────────────────────── Simulation ─────────────────────────

  update(dt: number) {
    if (this.over) return;
    this.time += dt;
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    for (const b of this.buildings) if (b.alive) this.updateBuilding(b, dt);
    this.separate(dt);
    this.cleanup();
    this.visIn -= dt;
    if (this.visIn <= 0) {
      this.visIn = 0.2;
      this.updateVision();
    }
  }

  private updateUnit(u: Unit, dt: number) {
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.lunge = Math.max(0, u.lunge - dt);
    u.flash = Math.max(0, u.flash - dt);
    u.moving = false;
    const o = u.order;

    // Automatische Zielsuche
    u.scanIn -= dt;
    if (u.scanIn <= 0) {
      u.scanIn = 0.35;
      const idleish = o.type === 'idle' || (o.type === 'move' && o.attack);
      if (u.military && idleish) {
        const t = this.findEnemy(u, u.stats.sight * TILE);
        if (t) this.setOrder(u, { type: 'attack', target: t, resume: o.type === 'move' ? o : undefined });
      }
    }

    switch (o.type) {
      case 'idle':
        return;
      case 'move':
        if (this.walkTo(u, dt, o.tx, o.ty, 1, 1, false)) this.setOrder(u, { type: 'idle' });
        return;
      case 'attack':
        return this.doAttack(u, dt, o);
      case 'gather':
        return this.doGather(u, dt);
      case 'build':
        return this.doBuild(u, dt, o.site, o.resume);
    }
  }

  private doAttack(u: Unit, dt: number, o: Extract<Order, { type: 'attack' }>) {
    const t = o.target;
    if (!t.alive) {
      // Nächstes Ziel in der Nähe suchen, sonst vorherigen Befehl fortsetzen
      const next = u.military ? this.findEnemy(u, u.stats.sight * TILE) : null;
      if (next) this.setOrder(u, { type: 'attack', target: next, resume: o.resume });
      else this.setOrder(u, o.resume ?? { type: 'idle' });
      return;
    }
    const range = u.stats.range * TILE;
    if (distTo(u, t) <= range + 1) {
      if (u.cooldown <= 0) {
        u.cooldown = u.stats.cooldown;
        this.strike(u, t);
      }
      return;
    }
    if (t instanceof Building) this.walkTo(u, dt, t.tx, t.ty, t.size, t.size, true);
    else {
      // Stehen bleiben, wenn Fernkämpfer fast in Reichweite ist — direkt annähern
      if (distTo(u, t) < TILE * 1.2) this.step(u, dt, t.x, t.y);
      else this.walkTo(u, dt, t.tx, t.ty, 1, 1, true, 0.5);
    }
  }

  private strike(u: Unit, t: Target) {
    const dmg = Math.max(1, u.stats.dmg - (t instanceof Unit ? t.stats.armor : t.stats.armor));
    if (u.kind === 'archer') {
      this.sound('arrow', u.x, u.y);
      this.fx.projectile(u.x, u.y - 6, t.x, t.y - 4, '#d9cfb8', () => this.damage(t, dmg, u));
    } else {
      u.lunge = 0.15;
      this.damage(t, dmg, u);
    }
  }

  damage(t: Target, dmg: number, by: Unit | Building | null) {
    if (!t.alive) return;
    t.hp -= dmg;
    t.flash = 0.08;
    this.sound('hit', t.x, t.y);
    if (t.faction === 'player' && this.time - this.lastAlert > 12) {
      this.lastAlert = this.time;
      this.emit('attacked', t.x, t.y);
      this.emit('msg', 'Wir werden angegriffen!');
      sfx.play('alert');
      buzz([40, 60, 40]);
    }
    // Vergeltung
    const busy = t instanceof Unit && t.order.type === 'attack' && t.order.target instanceof Unit;
    if (t instanceof Unit && by instanceof Unit && t.alive && t.military && !busy && (t.order.type !== 'move' || t.order.attack))
      this.setOrder(t, { type: 'attack', target: by, resume: t.order.type === 'move' ? t.order : undefined });
    if (t.hp <= 0) this.kill(t);
  }

  private kill(t: Target) {
    t.hp = 0;
    this.emit('died', t);
    if (t instanceof Unit) {
      this.fx.burst(t.x, t.y, PAL.team[t.faction].main, 10);
      this.fx.burst(t.x, t.y, '#7a2a20', 5);
      this.sound('die', t.x, t.y);
      t.carryIcon.destroy();
      this.scene.tweens.add({ targets: t.sprite, alpha: 0, angle: 90, duration: 400, onComplete: () => t.sprite.destroy() });
    } else {
      this.grid.setOcc(t.tx, t.ty, t.size, 0);
      for (let i = 0; i < 4; i++) this.fx.burst(t.x + (Math.random() - 0.5) * t.size * TILE, t.y, i % 2 ? PAL.stone : PAL.wood, 10, 24);
      this.sound('collapse', t.x, t.y);
      if (this.isVisible(t.x, t.y)) this.fx.shake(0.006);
      if (t.faction === 'player') buzz(120);
      this.scene.tweens.add({ targets: t.sprite, alpha: 0, scaleY: 0.3, duration: 500, onComplete: () => t.sprite.destroy() });
      this.checkEnd();
    }
    this.emit('res');
  }

  private checkEnd() {
    const alive = (f: Faction) => this.buildings.some((b) => b.alive && b.faction === f);
    if (!alive('enemy')) this.end(true);
    else if (!alive('player')) this.end(false);
  }

  private end(won: boolean) {
    if (this.over) return;
    this.over = true;
    sfx.play(won ? 'win' : 'lose');
    this.emit('over', won);
  }

  findEnemy(u: { x: number; y: number; faction: Faction }, radius: number): Target | null {
    let best: Target | null = null;
    let bd = radius;
    const foe = enemyOf(u.faction);
    for (const e of this.units) {
      if (e.faction !== foe || !e.alive) continue;
      // Kämpfer zuerst: Arbeiter wirken "weiter weg"
      const d = Math.hypot(e.x - u.x, e.y - u.y) + (e.military ? 0 : TILE * 1.5);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (b.faction !== foe || !b.alive) continue;
      const d = distToRect(u.x, u.y, b);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private doGather(u: Unit, dt: number) {
    const o = u.order;
    if (o.type !== 'gather') return;
    const mul = this.gatherMul[u.faction];
    if (o.phase === 'back') {
      const hall = this.nearestHall(u);
      if (!hall) return this.setOrder(u, { type: 'idle' });
      if (this.walkTo(u, dt, hall.tx, hall.ty, hall.size, hall.size, true)) {
        if (u.carry) {
          this.res[u.faction][u.carry.res] += u.carry.amount;
          if (u.faction === 'player') this.fx.text(u.x, u.y - 12, `+${u.carry.amount}`, u.carry.res === 'gold' ? PAL.gold : '#b5925f');
          u.carry = null;
          this.emit('res');
        }
        o.phase = 'to';
        u.path = [];
        u.pathFor = '';
      }
      return;
    }
    if (o.res === 'gold') {
      if (!o.mine || o.mine.gold <= 0) {
        const m = this.nearestMine(u);
        if (!m) return this.setOrder(u, { type: 'idle' });
        o.mine = m;
      }
      const m = o.mine;
      if (o.phase === 'to') {
        if (this.walkTo(u, dt, m.tx, m.ty, 3, 3, true)) {
          o.phase = 'work';
          o.timer = GATHER.mineTime / mul;
        }
      } else {
        o.timer -= dt;
        if (o.timer <= 0) {
          const amt = Math.min(GATHER.goldPerTrip, m.gold);
          m.gold -= amt;
          u.carry = { res: 'gold', amount: amt };
          if (m.gold <= 0) this.depleteMine(m);
          o.phase = 'back';
          u.path = [];
          u.pathFor = '';
        }
      }
    } else {
      if (this.grid.get(o.tree.x, o.tree.y) !== 'tree') {
        const t = this.grid.nearestTree({ x: u.tx, y: u.ty });
        if (!t) return this.setOrder(u, { type: 'idle' });
        o.tree = t;
        o.phase = 'to';
        u.path = [];
      }
      if (o.phase === 'to') {
        if (this.walkTo(u, dt, o.tree.x, o.tree.y, 1, 1, true)) {
          o.phase = 'work';
          o.timer = GATHER.chopTime / mul;
        }
      } else {
        o.timer -= dt;
        u.lunge = (o.timer % 0.6) < 0.12 ? 0.1 : 0;
        if ((o.timer % 0.6) < dt) this.sound('build', u.x, u.y);
        if (o.timer <= 0) {
          const i = this.grid.idx(o.tree.x, o.tree.y);
          const amt = Math.min(GATHER.woodPerTrip, this.grid.wood[i]);
          this.grid.wood[i] -= amt;
          u.carry = { res: 'wood', amount: amt };
          if (this.grid.wood[i] <= 0) this.fellTree(o.tree.x, o.tree.y);
          o.phase = 'back';
          u.path = [];
          u.pathFor = '';
        }
      }
    }
  }

  private fellTree(x: number, y: number) {
    const i = this.grid.idx(x, y);
    this.grid.terrain[i] = 'grass';
    const img = this.trees.get(i);
    if (img) {
      this.fx.burst(img.x, img.y - 8, PAL.treeMid, 8);
      img.destroy();
      this.trees.delete(i);
    }
  }

  private depleteMine(m: Mine) {
    this.grid.setOcc(m.tx, m.ty, 3, 0);
    this.mines = this.mines.filter((x) => x !== m);
    this.scene.tweens.add({ targets: m.sprite, alpha: 0.25, duration: 600 });
    this.emit('msg', 'Eine Goldmine ist erschöpft');
  }

  private doBuild(u: Unit, dt: number, site: Building, resume?: Order) {
    if (!site.alive || site.built) {
      this.setOrder(u, resume ?? { type: 'idle' });
      return;
    }
    if (!this.walkTo(u, dt, site.tx, site.ty, site.size, site.size, true)) return;
    const inc = dt / site.stats.time;
    site.progress = Math.min(1, site.progress + inc);
    site.hp = Math.min(site.maxHp, site.hp + site.maxHp * inc * 0.9);
    u.lunge = (this.time % 0.5) < 0.1 ? 0.1 : 0;
    if ((this.time % 0.5) < dt) this.sound('build', u.x, u.y);
    if (site.progress >= 1) {
      site.built = true;
      site.sprite.setTexture(site.tex);
      this.fx.burst(site.x, site.y, PAL.stone, 12, 20);
      if (site.faction === 'player') {
        sfx.play('done');
        this.emit('msg', `${site.stats.name} fertig`);
      }
      this.emit('res');
    }
  }

  private updateBuilding(b: Building, dt: number) {
    b.flash = Math.max(0, b.flash - dt);
    if (!b.built) return;
    if (b.queue.length) {
      b.trainT += dt;
      if (b.trainT >= UNITS[b.queue[0]].time) {
        const kind = b.queue.shift() as UnitKind;
        b.trainT = 0;
        const u = this.spawnNear(b, kind);
        if (b.faction === 'player') sfx.play('select');
        this.sendToRally(u, b);
      }
    }
    if (b.stats.attack) {
      b.cooldown -= dt;
      if (b.cooldown <= 0) {
        const t = this.findEnemy({ x: b.x, y: b.y, faction: b.faction }, b.stats.attack.range * TILE);
        if (t instanceof Unit) {
          b.cooldown = b.stats.attack.cooldown;
          const dmg = Math.max(1, b.stats.attack.dmg - t.stats.armor);
          this.sound('arrow', b.x, b.y);
          this.fx.projectile(b.x, b.y - 20, t.x, t.y - 4, '#e8dcc0', () => this.damage(t, dmg, b));
        }
      }
    }
  }

  private sendToRally(u: Unit, b: Building) {
    const r = b.rally;
    if (!r) {
      if (u.kind === 'worker') {
        const m = this.nearestMine(u);
        if (m && distToRect(u.x, u.y, m) < 12 * TILE) this.gatherMine(u, m);
      }
      return;
    }
    if (u.kind === 'worker') {
      const occ = this.grid.occ[this.grid.idx(r.x, r.y)];
      const mine = this.mines.find((m) => m.id === occ);
      if (mine) return this.gatherMine(u, mine);
      if (this.grid.get(r.x, r.y) === 'tree') return this.gatherTree(u, r);
    }
    this.setOrder(u, { type: 'move', tx: r.x, ty: r.y, attack: u.military });
  }

  // ───────────────────────── Bewegung ─────────────────────────

  /** Läuft zum Ziel-Rechteck. true = angekommen. */
  private walkTo(u: Unit, dt: number, rx: number, ry: number, rw: number, rh: number, adjacent: boolean, repathEvery = 0): boolean {
    const m = adjacent ? 1 : 0;
    const inGoal = u.tx >= rx - m && u.tx < rx + rw + m && u.ty >= ry - m && u.ty < ry + rh + m;
    const key = `${rx},${ry},${rw},${adjacent}`;
    if (inGoal) {
      u.path = [];
      return true;
    }
    u.repathIn -= dt;
    if (u.pathFor !== key || ((repathEvery || !u.path.length) && u.repathIn <= 0)) {
      u.pathFor = key;
      u.path = this.grid.findPath(u.tx, u.ty, rx, ry, rw, rh, adjacent) ?? [];
      // Kein Weg? In einer Sekunde erneut versuchen (Blockade kann sich lösen)
      u.repathIn = u.path.length ? repathEvery : 1;
      if (!u.path.length) return inGoal || this.giveUp(u);
    }
    if (!u.path.length) return inGoal || this.giveUp(u);
    const n = u.path[0];
    if (!this.grid.walkable(n.x, n.y)) {
      u.pathFor = '';
      return false;
    }
    const cx = (n.x + 0.5) * TILE;
    const cy = (n.y + 0.5) * TILE;
    if (this.step(u, dt, cx, cy)) u.path.shift();
    if (!u.path.length) {
      const nowIn = u.tx >= rx - m && u.tx < rx + rw + m && u.ty >= ry - m && u.ty < ry + rh + m;
      return nowIn || this.giveUp(u);
    }
    return false;
  }

  /** Ziel unerreichbar: Bewegung beenden (true), Kampf/Sammeln schaltet um. */
  private giveUp(u: Unit) {
    if (u.order.type === 'move') return true;
    if (u.order.type === 'gather' && u.order.res === 'wood' && u.order.phase === 'to') {
      const t = this.grid.nearestTree({ x: u.tx, y: u.ty }, 8);
      if (t && (t.x !== u.order.tree.x || t.y !== u.order.tree.y)) {
        u.order.tree = t;
        u.pathFor = '';
        return false;
      }
    }
    return false;
  }

  /** Ein Schritt Richtung (x,y). true = erreicht. */
  private step(u: Unit, dt: number, x: number, y: number) {
    const dx = x - u.x;
    const dy = y - u.y;
    const d = Math.hypot(dx, dy);
    const s = u.stats.speed * dt;
    u.moving = true;
    if (d <= s) {
      u.x = x;
      u.y = y;
      return true;
    }
    u.x += (dx / d) * s;
    u.y += (dy / d) * s;
    if (Math.abs(dx) > 0.5) u.sprite.setFlipX(dx < 0);
    return false;
  }

  /** Weiche Abstoßung, damit Gruppen nicht zu einem Pixel verschmelzen. */
  private separate(dt: number) {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        // Arbeiter laufen durcheinander durch — sonst verstopfen Sammelwege
        if (!b.alive || (a.kind === 'worker' && b.kind === 'worker')) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 81 || d2 === 0) continue;
        const d = Math.sqrt(d2);
        // Schwächer als Laufgeschwindigkeit, damit Gegenverkehr nie blockiert
        const push = ((9 - d) / d) * 3 * dt;
        this.nudge(a, -dx * push, -dy * push);
        this.nudge(b, dx * push, dy * push);
      }
    }
  }

  private nudge(u: Unit, dx: number, dy: number) {
    const nx = u.x + dx;
    const ny = u.y + dy;
    if (this.grid.walkable(Math.floor(nx / TILE), Math.floor(ny / TILE))) {
      u.x = nx;
      u.y = ny;
    }
  }

  private cleanup() {
    if (this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive);
    if (this.buildings.some((b) => !b.alive)) this.buildings = this.buildings.filter((b) => b.alive);
  }

  // ───────────────────────── Sicht ─────────────────────────

  private updateVision() {
    const { w, h } = this.grid;
    for (let i = 0; i < this.vis.length; i++) if (this.vis[i] === 2) this.vis[i] = 1;
    const reveal = (cx: number, cy: number, r: number) => {
      const r2 = r * r;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) this.vis[y * w + x] = 2;
    };
    for (const u of this.units) if (u.faction === 'player') reveal(u.x / TILE, u.y / TILE, u.stats.sight);
    for (const b of this.buildings) if (b.faction === 'player') reveal(b.x / TILE, b.y / TILE, b.stats.sight + b.size / 2);
  }

  isVisible(x: number, y: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return this.grid.inside(tx, ty) && this.vis[this.grid.idx(tx, ty)] === 2;
  }
  isExplored(tx: number, ty: number) {
    return this.grid.inside(tx, ty) && this.vis[this.grid.idx(tx, ty)] > 0;
  }
}
