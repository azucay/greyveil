# [T001] Projekt Setup

## Ziel
Ein lauffähiges Next.js 15 Projekt mit Phaser.js-Integration existiert. Die Entwicklungsumgebung ist vollständig konfiguriert. Beim Öffnen von `localhost:3000` läuft ein Phaser-Canvas im Browser mit einer leeren schwarzen Spielfläche.

## Kontext
Basis-Ticket für das gesamte Projekt. Alle anderen Tickets bauen darauf auf. Ohne dieses Setup kann kein weiteres Ticket begonnen werden.

**Abhängigkeiten:** Keine — dieses Ticket hat keine Vorgänger.

## Akzeptanzkriterien
- [ ] `npx create-next-app@latest` mit TypeScript, App Router, Tailwind
- [ ] Phaser.js 3 als Dependency installiert
- [ ] Phaser wird client-side initialisiert (`dynamic()` mit `ssr: false`)
- [ ] `app/page.tsx` rendert einen Container-`<div>`, in dem Phaser sein Canvas mountet
- [ ] Phaser `GameScene` ist leer aber läuft (schwarzer Canvas, keine Fehler in Console)
- [ ] TypeScript `strict: true` in `tsconfig.json`
- [ ] `@/` Import-Alias konfiguriert
- [ ] `AGENTS.md` Verzeichnisstruktur stimmt mit tatsächlicher Struktur überein
- [ ] `npm run dev` startet ohne Fehler
- [ ] `npm run build` produziert keine TypeScript-Fehler

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] Keine Abhängigkeiten zu anderen Tickets

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler (`npm run build` sauber)
- [ ] Manueller Test: Browser öffnet `localhost:3000`, Phaser-Canvas ist sichtbar, keine Console-Fehler
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Phaser + Next.js Integration:**
Phaser ist nicht SSR-kompatibel (nutzt `window`, `document`). Import muss zwingend über `dynamic()` aus `next/dynamic` mit `{ ssr: false }` erfolgen.

```typescript
// app/page.tsx
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false })
```

**Phaser Game Config:**
```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  scene: [BootScene, GameScene, UIScene],
}
```

**Verzeichnisse anlegen:**
`/game/scenes/`, `/game/entities/`, `/game/systems/`, `/components/`, `/types/`, `/public/assets/`

**Keine Assets:** `/public/assets/` bleibt leer — ein `.gitkeep` reicht.
