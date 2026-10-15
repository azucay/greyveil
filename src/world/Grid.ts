import { GATHER, MAP_H, MAP_W } from '@/config';

export type Terrain = 'grass' | 'water' | 'rock' | 'tree';

export interface Point {
  x: number;
  y: number;
}

export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Tile-Gitter: Terrain, Holzvorrat, Belegung durch Gebäude/Minen + A*. */
export class Grid {
  readonly w = MAP_W;
  readonly h = MAP_H;
  terrain: Terrain[] = new Array<Terrain>(MAP_W * MAP_H).fill('grass');
  wood: number[] = new Array<number>(MAP_W * MAP_H).fill(0);
  /** Entity-ID des Gebäudes/der Mine auf dem Tile, 0 = frei. */
  occ: number[] = new Array<number>(MAP_W * MAP_H).fill(0);

  idx(x: number, y: number) {
    return y * this.w + x;
  }
  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): Terrain {
    return this.terrain[this.idx(x, y)];
  }
  walkable(x: number, y: number) {
    if (!this.inside(x, y)) return false;
    const i = this.idx(x, y);
    return this.terrain[i] === 'grass' && this.occ[i] === 0;
  }
  buildable(x: number, y: number, size: number) {
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) if (!this.walkable(x + dx, y + dy)) return false;
    return true;
  }
  setOcc(x: number, y: number, size: number, id: number) {
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) this.occ[this.idx(x + dx, y + dy)] = id;
  }

  /** Erzeugt eine Karte mit zwei Basen (unten links Spieler, oben rechts Gegner). */
  generate(seed: number) {
    const rnd = mulberry32(seed);
    const blob = (t: Terrain, cx: number, cy: number, r: number) => {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          if (!this.inside(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy) + rnd() * 1.4;
          if (d < r) this.terrain[this.idx(x, y)] = t;
        }
    };
    // Zentraler See + kleine Teiche, Felsen, Wälder
    blob('water', this.w / 2 + (rnd() - 0.5) * 4, this.h / 2 + (rnd() - 0.5) * 4, 4.5);
    for (let i = 0; i < 3; i++) blob('water', 6 + rnd() * (this.w - 12), 6 + rnd() * (this.h - 12), 1.5 + rnd() * 1.5);
    for (let i = 0; i < 6; i++) blob('rock', 4 + rnd() * (this.w - 8), 4 + rnd() * (this.h - 8), 1 + rnd() * 1.6);
    for (let i = 0; i < 16; i++) blob('tree', rnd() * this.w, rnd() * this.h, 2 + rnd() * 2.5);
    // Waldrand entlang der Kartenränder
    for (let x = 0; x < this.w; x++)
      for (let y = 0; y < this.h; y++) {
        const edge = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        if (edge === 0 || (edge === 1 && rnd() < 0.5)) this.terrain[this.idx(x, y)] = 'tree';
      }

    // Basen freiräumen, eigener Wald nahe jeder Basis
    for (const b of this.bases()) {
      blob('grass', b.x + 1, b.y + 1, 7);
      const s = b.x < this.w / 2 ? 1 : -1;
      blob('tree', b.x + 1 - s * 6, b.y + 1 + s * 5, 2.4);
      blob('tree', b.x + 1 + s * 1, b.y + 1 + s * 7, 2);
    }
    // Korridor zwischen den Basen garantieren
    const [p, e] = this.bases();
    let x = p.x + 1;
    let y = p.y + 1;
    while (x !== e.x + 1 || y !== e.y + 1) {
      if (rnd() < 0.5 && x !== e.x + 1) x += Math.sign(e.x + 1 - x);
      else if (y !== e.y + 1) y += Math.sign(e.y + 1 - y);
      else x += Math.sign(e.x + 1 - x);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (this.inside(x + dx, y + dy)) this.terrain[this.idx(x + dx, y + dy)] = 'grass';
    }
    for (let i = 0; i < this.terrain.length; i++) this.wood[i] = this.terrain[i] === 'tree' ? GATHER.treeWood : 0;
  }

  /** Rathaus-Ursprung (oben links, 3×3) von Spieler und Gegner. */
  bases(): [Point, Point] {
    return [
      { x: 6, y: this.h - 10 },
      { x: this.w - 9, y: 7 },
    ];
  }

  /** Spiralsuche nach dem nächsten Platz für ein size×size-Objekt. */
  findFree(near: Point, size: number, margin = 1, minDist = 0, maxR = 14, ok: (p: Point) => boolean = () => true): Point | null {
    for (let r = minDist; r <= maxR; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = near.x + dx;
          const y = near.y + dy;
          if (this.buildable(x - margin, y - margin, size + margin * 2) && ok({ x, y })) return { x, y };
        }
    return null;
  }

  nearestTree(from: Point, maxR = 18): Point | null {
    let best: Point | null = null;
    let bd = Infinity;
    for (let y = Math.max(0, from.y - maxR); y < Math.min(this.h, from.y + maxR); y++)
      for (let x = Math.max(0, from.x - maxR); x < Math.min(this.w, from.x + maxR); x++) {
        if (this.get(x, y) !== 'tree') continue;
        if (!this.hasWalkableNeighbor(x, y)) continue;
        const d = Math.hypot(x - from.x, y - from.y);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    return best;
  }

  hasWalkableNeighbor(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.walkable(x + dx, y + dy)) return true;
    return false;
  }

  /**
   * A* auf 8-Nachbarschaft. Ziel ist ein Rechteck (rx,ry,rw,rh): erreicht, wenn man darin
   * oder direkt daneben steht (adjacent=true) — deckt Bewegung, Bäume, Gebäude ab.
   */
  findPath(sx: number, sy: number, rx: number, ry: number, rw = 1, rh = 1, adjacent = false, maxNodes = 3000): Point[] | null {
    const inGoal = (x: number, y: number) => {
      const m = adjacent ? 1 : 0;
      return x >= rx - m && x < rx + rw + m && y >= ry - m && y < ry + rh + m;
    };
    const cx = rx + (rw - 1) / 2;
    const cy = ry + (rh - 1) / 2;
    const hfn = (x: number, y: number) => {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    if (inGoal(sx, sy)) return [];
    const W = this.w;
    const g = new Map<number, number>();
    const came = new Map<number, number>();
    const heap = new MinHeap();
    const s = sy * W + sx;
    g.set(s, 0);
    heap.push(s, hfn(sx, sy));
    let best = s;
    let bestH = hfn(sx, sy);
    let n = 0;
    while (heap.size && n++ < maxNodes) {
      const cur = heap.pop();
      const x = cur % W;
      const y = (cur - x) / W;
      if (inGoal(x, y)) return this.rebuild(came, cur);
      const gc = g.get(cur) ?? 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!this.walkable(nx, ny)) continue;
          if (dx && dy && (!this.walkable(x + dx, y) || !this.walkable(x, y + dy))) continue;
          const ni = ny * W + nx;
          const ng = gc + (dx && dy ? 1.414 : 1);
          if (ng < (g.get(ni) ?? Infinity)) {
            g.set(ni, ng);
            came.set(ni, cur);
            const h = hfn(nx, ny);
            if (h < bestH) {
              bestH = h;
              best = ni;
            }
            heap.push(ni, ng + h);
          }
        }
    }
    // Ziel unerreichbar → so nah wie möglich heran
    return best === s ? null : this.rebuild(came, best);
  }

  private rebuild(came: Map<number, number>, end: number): Point[] {
    const out: Point[] = [];
    let c: number | undefined = end;
    while (c !== undefined && came.has(c)) {
      out.push({ x: c % this.w, y: Math.floor(c / this.w) });
      c = came.get(c);
    }
    return out.reverse();
  }
}

class MinHeap {
  private k: number[] = [];
  private p: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, pr: number) {
    const { k, p } = this;
    let i = k.length;
    k.push(key);
    p.push(pr);
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[i], k[par]] = [k[par], k[i]];
      [p[i], p[par]] = [p[par], p[i]];
      i = par;
    }
  }
  pop(): number {
    const { k, p } = this;
    const top = k[0];
    const lk = k.pop() as number;
    const lp = p.pop() as number;
    if (k.length) {
      k[0] = lk;
      p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[i], k[m]] = [k[m], k[i]];
        [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}
