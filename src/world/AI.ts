import { AI, AiProfile, BUILDINGS, BuildingKind, Difficulty, MAX_POP, TILE, UNITS } from '@/config';
import { Building, distToRect, Unit } from '@/world/Entities';
import { World } from '@/world/World';

const F = 'enemy';

/** Regelbasierter Gegner: Wirtschaft → Ausbau → Armee → Angriffswellen + Verteidigung. */
export class EnemyAI {
  private p: AiProfile;
  private thinkIn = 2;
  private nextWave: number;
  private waveSize: number;
  private trainToggle = 0;

  constructor(
    private world: World,
    difficulty: Difficulty,
  ) {
    this.p = AI[difficulty];
    this.nextWave = this.p.firstWaveAt;
    this.waveSize = this.p.waveSize;
    world.gatherMul.enemy = this.p.gatherMul;
  }

  update(dt: number) {
    this.thinkIn -= dt;
    if (this.thinkIn > 0 || this.world.over) return;
    this.thinkIn = this.p.thinkEvery;
    const w = this.world;
    const mine = w.units.filter((u) => u.faction === F);
    const workers = mine.filter((u) => !u.military);
    const army = mine.filter((u) => u.military);
    const blds = w.buildings.filter((b) => b.faction === F);
    const hall = blds.find((b) => b.kind === 'hall' && b.built);
    if (!hall) return;

    this.economy(hall, workers);
    this.construct(hall, workers, blds);
    this.trainArmy(blds);
    if (!this.defend(blds, army)) this.attack(hall, army);
  }

  private economy(hall: Building, workers: Unit[]) {
    const w = this.world;
    if (workers.length < this.p.workerTarget && hall.queue.length === 0) w.train(hall, 'worker');
    let onGold = workers.filter((u) => u.order.type === 'gather' && u.order.res === 'gold').length;
    const goldShare = 0.6;
    const m = w.nearestMine(hall);
    const tree = () => w.grid.nearestTree({ x: hall.tx + 1, y: hall.ty + 1 }, 24);
    for (const u of workers) {
      if (u.order.type !== 'idle') continue;
      if (m && (onGold < workers.length * goldShare || u.carry?.res === 'gold')) {
        w.gatherMine(u, m);
        onGold++;
      } else {
        const t = tree();
        if (t) w.gatherTree(u, t);
        else if (m) w.gatherMine(u, m);
      }
    }
    // Umverteilen: zu viele am Gold → einer wechselt zum Holz
    if (onGold > Math.ceil(workers.length * goldShare) + 1) {
      const mover = workers.find((u) => u.order.type === 'gather' && u.order.res === 'gold' && !u.carry);
      const t = tree();
      if (mover && t) w.gatherTree(mover, t);
    }
  }

  private construct(hall: Building, workers: Unit[], blds: Building[]) {
    const w = this.world;
    const site = blds.find((b) => !b.built);
    if (site) {
      // Baustelle ohne Arbeiter? Einen hinschicken.
      if (!workers.some((u) => u.order.type === 'build' && u.order.site === site)) {
        const b = this.builder(workers);
        if (b) w.assist(b, site);
      }
      return;
    }
    const count = (k: BuildingKind) => blds.filter((b) => b.kind === k).length;
    const pop = w.pop(F);
    const cap = w.cap(F);
    let want: BuildingKind | null = null;
    if (cap - pop <= 2 && cap < MAX_POP) want = 'farm';
    else if (count('barracks') < 1 && workers.length >= 5) want = 'barracks';
    else if (count('tower') < this.p.towers && count('barracks') >= 1 && w.time > 150) want = 'tower';
    else if (count('barracks') < this.p.barracks && w.time > 240) want = 'barracks';
    if (!want || !w.canAfford(F, BUILDINGS[want].cost)) return;
    const size = BUILDINGS[want].size;
    // Türme Richtung Spieler, alles andere kompakt um das Rathaus
    const [pb] = w.grid.bases();
    const toward = want === 'tower' ? 4 : 2;
    const nx = hall.tx + Math.sign(pb.x - hall.tx) * toward;
    const ny = hall.ty + Math.sign(pb.y - hall.ty) * toward;
    const spot = w.grid.findFree({ x: nx, y: ny }, size, 1, 0, 12);
    const b = this.builder(workers);
    if (spot && b && w.canPlace(want, spot.x, spot.y)) w.build([b], want, spot.x, spot.y);
  }

  private builder(workers: Unit[]) {
    return (
      workers.find((u) => u.order.type === 'gather' && u.order.res === 'wood' && !u.carry) ??
      workers.find((u) => u.order.type === 'idle') ??
      workers.find((u) => u.order.type === 'gather')
    );
  }

  private trainArmy(blds: Building[]) {
    const w = this.world;
    const wantsBuilding = w.cap(F) - w.pop(F) <= 2;
    for (const b of blds) {
      if (b.kind !== 'barracks' || !b.built) continue;
      // Forschung, sobald genug Polster da ist (Klingen zuerst)
      if (this.p.upgrades && !b.research && w.time > 200 && !wantsBuilding)
        for (const key of ['atk', 'def'] as const) {
          const c = w.nextUpgrade(F, key);
          if (c && !w.researching(F, key) && w.res[F].gold >= c.gold + 150 && w.res[F].wood >= c.wood) {
            w.research(b, key);
            break;
          }
        }
      if (b.queue.length >= (this.p.armyReserve ? 1 : 2)) continue;
      const kind = this.trainToggle++ % 5 < 3 ? 'footman' : 'archer';
      const reserve = (wantsBuilding ? BUILDINGS.farm.cost.gold : 0) + this.p.armyReserve;
      if (w.res[F].gold - UNITS[kind].cost.gold >= reserve) w.train(b, kind);
    }
  }

  /** Spieler-Einheiten nahe der eigenen Basis → alle Kämpfer verteidigen. */
  private defend(blds: Building[], army: Unit[]) {
    const w = this.world;
    const intruder = w.units.find((u) => u.faction === 'player' && blds.some((b) => distToRect(u.x, u.y, b) < 8 * TILE));
    if (!intruder) return false;
    const free = army.filter((u) => u.order.type !== 'attack');
    w.commandAttack(free, intruder);
    return true;
  }

  private attack(hall: Building, army: Unit[]) {
    const w = this.world;
    const home = army.filter((u) => distToRect(u.x, u.y, hall) < 12 * TILE);
    const ready = w.time >= this.nextWave && home.length >= this.waveSize;
    const overflow = w.time >= this.p.firstWaveAt * (this.p.armyReserve ? 1 : 0.6) && home.length >= this.waveSize + 6;
    if (ready || overflow) {
      this.nextWave = w.time + 70;
      this.waveSize += this.p.waveGrowth;
      this.sendTo(home);
      return;
    }
    // Angreifer im Feld, die idle sind, zum nächsten Ziel weiterschicken
    const roaming = army.filter((u) => u.order.type === 'idle' && distToRect(u.x, u.y, hall) >= 12 * TILE);
    if (roaming.length) this.sendTo(roaming);
  }

  private sendTo(units: Unit[]) {
    const w = this.world;
    if (!units.length) return;
    const c = units[0];
    let target: Building | null = null;
    let bd = Infinity;
    for (const b of w.buildings) {
      if (b.faction !== 'player') continue;
      const d = distToRect(c.x, c.y, b) + (b.kind === 'hall' ? -4 * TILE : 0);
      if (d < bd) {
        bd = d;
        target = b;
      }
    }
    if (target) w.commandMove(units, target.tx + 1, target.ty + 1, true);
  }
}
