import { BUILDINGS, BuildingKind, Cost, hex, PAL, TILE, UNITS, UnitKind, UPGRADES, UpgradeKey } from '@/config';
import type { GameScene } from '@/scenes/GameScene';
import { Unit } from '@/world/Entities';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** DOM-HUD über dem Canvas: Ressourcen, Auswahl-Panel, Schnellzugriffe, Minimap. */
export class Hud {
  private icons = new Map<string, string>();
  private toastT = 0;
  private idleIdx = 0;
  private timer = 0;
  private alertAt: { x: number; y: number; t: number } | null = null;

  constructor(private scene: GameScene) {
    const w = scene.world;
    scene.hooks = { onSelection: () => this.render(), onPlacement: () => this.render() };
    w.on('res', () => this.updateTop());
    w.on('msg', (m) => this.toast(m));
    w.on('attacked', (x, y) => (this.alertAt = { x, y, t: performance.now() }));

    $('btn-idle').onclick = () => this.cycleIdle();
    $('btn-army').onclick = () => {
      const army = w.units.filter((u) => u.faction === 'player' && u.military);
      if (!army.length) return this.toast('Keine Armee');
      scene.select({ units: army });
    };
    $('btn-speed').onclick = () => {
      scene.speed = scene.speed === 1 ? 2 : 1;
      $('btn-speed').textContent = `${scene.speed}×`;
    };
    $('btn-speed').textContent = '1×';
    $('btn-desel').onclick = () => (scene.cancelPlacing(), scene.select(null));
    const mm = $<HTMLCanvasElement>('minimap');
    mm.width = w.grid.w * 2;
    mm.height = w.grid.h * 2;
    const jump = (e: PointerEvent) => {
      const r = mm.getBoundingClientRect();
      scene.centerOn(((e.clientX - r.left) / r.width) * w.grid.w * TILE, ((e.clientY - r.top) / r.height) * w.grid.h * TILE);
    };
    mm.onpointerdown = (e) => {
      jump(e);
      mm.setPointerCapture(e.pointerId);
    };
    mm.onpointermove = (e) => e.buttons && jump(e);

    this.updateTop();
    this.render();
    $('hud').hidden = false;
  }

  /** Wird pro Frame vom main-Loop gerufen; zeichnet gedrosselt. */
  tick(dt: number) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    this.updateTop();
    this.drawMinimap();
    this.updateLive();
    this.updateGoal();
    if (this.toastT && performance.now() > this.toastT) {
      $('toast').classList.remove('show');
      this.toastT = 0;
    }
  }

  /** Kleine Ziel-Leiste fürs Onboarding — verschwindet, sobald alles erledigt ist. */
  private updateGoal() {
    const w = this.scene.world;
    const has = (k: BuildingKind) => w.buildings.some((b) => b.faction === 'player' && b.kind === k && b.built);
    const army = w.units.filter((u) => u.faction === 'player' && u.military).length;
    const workers = w.units.filter((u) => u.faction === 'player' && u.kind === 'worker').length;
    const goals: [boolean, string][] = [
      [workers >= 6, 'Bilde Arbeiter im Rathaus (6)'],
      [has('farm'), 'Baue eine Farm (Arbeiter wählen)'],
      [has('barracks'), 'Baue eine Kaserne'],
      [army >= 5, `Stelle eine Armee auf (${army}/5)`],
      [w.stats.player.kills >= 3, 'Finde die Horde (oben rechts) und greife an'],
    ];
    const next = goals.find(([done]) => !done);
    const el = $('goal');
    el.hidden = !next || w.time > 900;
    if (next) el.textContent = `◆ ${next[1]}`;
  }

  toast(msg: string) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    this.toastT = performance.now() + 2200;
  }

  private icon(key: string): string {
    let url = this.icons.get(key);
    if (!url) {
      const src = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
      url = src.toDataURL();
      this.icons.set(key, url);
    }
    return url;
  }

  private updateTop() {
    const w = this.scene.world;
    $('r-gold').textContent = String(w.res.player.gold);
    $('r-wood').textContent = String(w.res.player.wood);
    const pop = w.pop('player');
    const cap = w.cap('player');
    $('r-pop').textContent = `${pop}/${cap}`;
    $('r-pop').parentElement?.classList.toggle('warn', pop >= cap);
    const idle = w.units.filter((u) => u.faction === 'player' && u.kind === 'worker' && u.order.type === 'idle').length;
    const badge = $('idle-count');
    badge.textContent = String(idle);
    badge.hidden = idle === 0;
    $('btn-idle').classList.toggle('pulse', idle > 0);
    for (const el of document.querySelectorAll<HTMLElement>('[data-gold]')) el.classList.toggle('short', w.res.player.gold < Number(el.dataset.gold));
    for (const el of document.querySelectorAll<HTMLElement>('[data-wood]')) el.classList.toggle('short', w.res.player.wood < Number(el.dataset.wood));
  }

  private cycleIdle() {
    const w = this.scene.world;
    const idle = w.units.filter((u) => u.faction === 'player' && u.kind === 'worker' && u.order.type === 'idle');
    if (!idle.length) return this.toast('Alle Arbeiter beschäftigt');
    const u = idle[this.idleIdx++ % idle.length];
    this.scene.select({ units: [u] });
    this.scene.centerOn(u.x, u.y);
  }

  private costHtml(c: Cost) {
    const g = `<span data-gold="${c.gold}"><i class="ic-gold"></i>${c.gold}</span>`;
    const h = c.wood ? `<span data-wood="${c.wood}"><i class="ic-wood"></i>${c.wood}</span>` : '';
    return `<small class="cost">${g}${h}</small>`;
  }

  private button(label: string, iconKey: string | null, cost: Cost | null, onClick: () => void, cls = '') {
    const b = document.createElement('button');
    b.className = `act ${cls}`;
    b.innerHTML = `${iconKey ? `<img src="${this.icon(iconKey)}" alt="">` : ''}<span class="lbl">${label}</span>${cost ? this.costHtml(cost) : ''}`;
    b.onclick = () => {
      onClick();
      this.render();
    };
    return b;
  }

  /** Panel neu aufbauen (bei Auswahl-/Modus-Wechsel). */
  render() {
    this.renderPanel();
    this.updateTop();
  }

  private renderPanel() {
    const s = this.scene;
    const info = $('sel-info');
    const acts = $('actions');
    acts.innerHTML = '';
    const panel = $('panel');

    if (s.placing) {
      const k = s.placing.kind;
      panel.hidden = false;
      info.innerHTML = `<b>${BUILDINGS[k].name} platzieren</b><span class="hint">Tippe auf die Karte, um den Bauplatz zu verschieben</span>`;
      acts.append(
        this.button('Bauen', null, null, () => s.confirmPlacing(), 'ok'),
        this.button('Abbruch', null, null, () => s.cancelPlacing(), 'cancel'),
      );
      return;
    }

    const units = s.selectedUnits;
    const b = s.selectedBuilding;
    if (!units.length && !b) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    if (units.length) {
      info.innerHTML = this.unitInfo(units);
      if (units.some((u) => u.kind === 'worker')) {
        for (const k of ['farm', 'barracks', 'tower', 'hall'] as BuildingKind[])
          acts.append(this.button(BUILDINGS[k].name, `b_${k}_player`, BUILDINGS[k].cost, () => s.startPlacing(k)));
      }
      acts.append(this.button('Halt', null, null, () => units.forEach((u) => s.world.setOrder(u, { type: 'idle' })), 'cancel'));
      return;
    }

    if (b) {
      info.innerHTML = `<div class="row"><img class="big" src="${this.icon(b.built ? b.tex : `b_${b.kind}_player`)}"><div><b>${b.stats.name}</b><span class="hp" data-live="hp"></span><span class="hint" data-live="state"></span></div></div>`;
      if (b.built) {
        for (const k of b.stats.trains) acts.append(this.button(UNITS[k].name, `u_${k}_player`, UNITS[k].cost, () => s.world.train(b, k)));
        if (b.kind === 'barracks')
          for (const key of ['atk', 'def'] as UpgradeKey[]) {
            const c = s.world.nextUpgrade('player', key);
            const lvl = s.world.upg.player[key];
            if (c && !s.world.researching('player', key))
              acts.append(this.button(`${UPGRADES[key].name} ${'I'.repeat(lvl + 1)}`, null, c, () => s.world.research(b, key), key === 'atk' ? 'upg-atk' : 'upg-def'));
          }
        if (b.queue.length) acts.append(this.button('Abbruch', null, null, () => s.world.cancelTrain(b), 'cancel'));
      }
      this.updateLive();
    }
  }

  private unitInfo(units: Unit[]) {
    if (units.length === 1) {
      const u = units[0];
      const st = u.stats;
      return `<div class="row"><img class="big" src="${this.icon(`u_${u.kind}_player`)}"><div><b>${st.name}</b><span class="hp" data-live="hp"></span><span class="hint" data-live="state"></span></div></div>`;
    }
    const counts = new Map<UnitKind, number>();
    for (const u of units) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1);
    const chips = [...counts].map(([k, n]) => `<span class="chip"><img src="${this.icon(`u_${k}_player`)}">${n}</span>`).join('');
    return `<b>${units.length} Einheiten</b><div class="chips">${chips}</div>`;
  }

  /** Werte, die sich ständig ändern (HP, Fortschritt), ohne Panel-Neuaufbau. */
  private updateLive() {
    const s = this.scene;
    const hp = document.querySelector<HTMLElement>('[data-live="hp"]');
    const st = document.querySelector<HTMLElement>('[data-live="state"]');
    if (!hp || !st) return;
    const u = s.selectedUnits[0];
    const b = s.selectedBuilding;
    if (u && s.selectedUnits.length === 1) {
      hp.textContent = `${Math.ceil(u.hp)} / ${u.maxHp} LP`;
      const o = u.order;
      st.textContent =
        o.type === 'gather' ? (o.res === 'gold' ? 'Schürft Gold' : 'Fällt Holz') : o.type === 'build' ? 'Baut' : o.type === 'attack' ? 'Kämpft' : o.type === 'move' ? 'Unterwegs' : 'Bereit';
    } else if (b) {
      hp.textContent = `${Math.ceil(b.hp)} / ${b.maxHp} LP`;
      if (!b.built) st.textContent = `Im Bau · ${Math.floor(b.progress * 100)}%`;
      else if (b.research) st.textContent = `Erforscht ${UPGRADES[b.research.key].name} · ${Math.floor((b.research.t / UPGRADES[b.research.key].time) * 100)}%`;
      else if (b.queue.length) st.textContent = `Bildet aus: ${b.queue.map((k) => UNITS[k].name).join(', ')}`;
      else if (b.stats.trains.length) st.textContent = 'Tippe Karte = Sammelpunkt';
      else st.textContent = b.kind === 'farm' ? '+5 Versorgung' : 'Verteidigt die Basis';
    }
  }

  private drawMinimap() {
    const w = this.scene.world;
    const g = w.grid;
    const ctx = $<HTMLCanvasElement>('minimap').getContext('2d');
    if (!ctx) return;
    const col = { grass: PAL.grass[0], water: PAL.water, rock: PAL.rock, tree: PAL.treeMid };
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const v = w.vis[g.idx(x, y)];
        ctx.fillStyle = v === 0 ? PAL.fog : col[g.get(x, y)];
        ctx.fillRect(x * 2, y * 2, 2, 2);
        if (v === 1) {
          ctx.fillStyle = 'rgba(11,13,16,0.5)';
          ctx.fillRect(x * 2, y * 2, 2, 2);
        }
      }
    for (const m of w.mines) {
      ctx.fillStyle = PAL.gold;
      if (w.isExplored(m.tx, m.ty)) ctx.fillRect(m.tx * 2, m.ty * 2, 6, 6);
    }
    for (const b of w.buildings) {
      if (b.faction === 'enemy' && !w.isExplored(b.tx, b.ty)) continue;
      ctx.fillStyle = PAL.team[b.faction].light;
      ctx.fillRect(b.tx * 2, b.ty * 2, b.size * 2, b.size * 2);
    }
    for (const u of w.units) {
      if (u.faction === 'enemy' && !w.isVisible(u.x, u.y)) continue;
      ctx.fillStyle = u.faction === 'player' ? css(hex(PAL.team.player.light)) : css(hex(PAL.team.enemy.light));
      ctx.fillRect(Math.floor((u.x / TILE) * 2) - 1, Math.floor((u.y / TILE) * 2) - 1, 2, 2);
    }
    if (this.alertAt && performance.now() - this.alertAt.t < 4000) {
      const on = Math.floor(performance.now() / 250) % 2 === 0;
      if (on) {
        ctx.strokeStyle = '#ff6b4a';
        ctx.lineWidth = 1;
        ctx.strokeRect((this.alertAt.x / TILE) * 2 - 5, (this.alertAt.y / TILE) * 2 - 5, 10, 10);
      }
    }
    const v = this.scene.cameras.main.worldView;
    ctx.strokeStyle = '#e6dcc4';
    ctx.lineWidth = 1;
    ctx.strokeRect((v.x / TILE) * 2 + 0.5, (v.y / TILE) * 2 + 0.5, (v.width / TILE) * 2, (v.height / TILE) * 2);
  }
}
