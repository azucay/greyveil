# AGENTS.md — Operativer Guide für Greyveil

## Projekt-Übersicht

Greyveil ist ein Fantasy-RTS im Browser, gebaut mit Phaser.js und Next.js. Spieler bauen eine Basis, sammeln Ressourcen, bilden Einheiten aus und bekämpfen einen KI-Gegner. Das Kern-Differenzierungsmerkmal ist ein Hybrid-AI-Gegner: regelbasierte Mikro-Steuerung kombiniert mit Claude API für Makrostrategie-Entscheidungen. MVP läuft vollständig im Browser, ist PWA-fähig und verwendet ausschließlich die Phaser.js Graphics API für alle visuellen Elemente.

---

## Tech Stack

| Technologie | Zweck |
|---|---|
| Phaser.js 3 | Game Engine (Rendering, Input, Physics) |
| Next.js 15 App Router | Web-Framework, Seiten, API Routes |
| TypeScript (strict) | Typsicherheit im gesamten Projekt |
| Claude API (claude-sonnet-4-6) | Makrostrategie des AI-Gegners |
| Vercel | Hosting und Deployment |

---

## Verzeichnisstruktur

```
/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Startseite / Game-Einstiegspunkt
│   └── api/
│       └── ai/
│           └── route.ts    # Claude API Endpunkt für AI-Makrostrategie
├── game/                   # Phaser.js Game Engine
│   ├── scenes/             # Phaser Scenes
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── GameScene.ts
│   │   └── UIScene.ts
│   ├── entities/           # Einheiten und Gebäude
│   │   ├── units/
│   │   └── buildings/
│   └── systems/            # Spielsysteme
│       ├── ResourceSystem.ts
│       ├── CombatSystem.ts
│       └── AISystem.ts
├── components/             # React UI Komponenten
│   └── hud/                # HUD, Menüs, Overlays
├── public/
│   └── assets/             # Leer im MVP — reserviert für Post-MVP
├── tickets/                # Ticket-Dokumentation
└── types/                  # Geteilte TypeScript-Typen
```

---

## Coding Conventions

- **TypeScript strict mode** — kein `any`, kein `@ts-ignore` ohne Kommentar mit Begründung
- **Keine externen Assets im MVP** — ausschließlich Phaser.js Graphics API (geometrische Formen)
- Komponenten in `/components`, Game-Logik in `/game`, React-Seiten in `/app`
- Dateinamen: PascalCase für Klassen/Komponenten, camelCase für Utilities
- Phaser-Entities als TypeScript-Klassen, die `Phaser.GameObjects.Container` erweitern
- API Routes verwenden Next.js Route Handler (`route.ts`)
- Kein `console.log` in Production-Code — stattdessen strukturiertes Logging via eigenem Logger
- Imports: absolut via `@/` Alias, kein relativer Import aus übergeordneten Verzeichnissen

---

## Asset-Konventionen (MVP)

**Bewusste Entscheidung: Geometric Placeholders**

Das MVP verwendet ausschließlich die Phaser.js Graphics API. Kein externes Asset-Pack wird vorgezogen.

| Element | Darstellung | Farbe |
|---|---|---|
| Spieler-Einheiten | Kreis | Blau (#3B82F6) |
| Gegner-Einheiten | Kreis | Rot (#EF4444) |
| Rathaus | Rechteck | Dunkelgrau (#374151) |
| Kaserne | Rechteck | Braun (#92400E) |
| Farm | Rechteck | Grün (#166534) |
| Mine | Rechteck | Dunkelbraun (#451A03) |
| Holz-Ressource | Kleines Quadrat | Grün (#4ADE80) |
| Stein-Ressource | Kleines Quadrat | Grau (#9CA3AF) |
| Metall-Ressource | Kleines Quadrat | Silber (#CBD5E1) |
| Gold-Ressource | Kleines Quadrat | Gelb (#FCD34D) |
| Gras-Terrain | Tile | Hellgrün (#86EFAC) |
| Wasser-Terrain | Tile | Blau (#60A5FA) |
| Berg-Terrain | Tile | Grau (#6B7280) |

Asset-Swap auf echte Grafiken (z.B. Kenney.nl Medieval Pack) ist Post-MVP in separatem Ticket geplant. Placeholders sind in `/game/entities` und `/game/scenes` isoliert — kein Refactoring der Spiellogik nötig.

---

## Workflow

```
1 Ticket = 1 Feature Branch
Branch-Name: ticket/T00X-kurztitel
↓
Implementierung gemäß Ticket-File in /tickets/
↓
Manueller Test (Definition of Done prüfen)
↓
Learning-Eintrag in AGENTS.md schreiben
↓
Commit + Push → Review → Merge to main
```

**Wichtige Regel:** Nach jedem abgeschlossenen Ticket wird ein neuer Eintrag unter "Learnings" (unten) im vorgegebenen Format geschrieben. Ziel: Neue Agents können das Projekt sofort aufgreifen.

---

## Bekannte Fallstricke

- Phaser hat keinen Default-Export: `import * as Phaser from 'phaser'` verwenden, nicht `import Phaser from 'phaser'`
- `dynamic(() => ..., { ssr: false })` ist in Next.js 15 Server Components verboten — muss in einer `'use client'`-Komponente stehen
- Phaser greift beim Modulimport auf `window` zu → `page.tsx` muss `'use client'` sein oder den Import vollständig client-seitig lazy-loaden
- `scene.make.graphics({ add: false })` existiert in Phaser 3.90 nicht mehr — stattdessen `scene.add.graphics()` verwenden und nach RT-Draw mit `destroy()` entfernen

---

## Learnings

---
### [T001] Projekt Setup — 2026-05-09
**Was ich vorher hätte wissen sollen:**
- Phaser 3.x exportiert kein Default-Export: `import * as Phaser from 'phaser'` ist der korrekte Import-Stil
- Next.js 15 App Router verbietet `dynamic(() => ..., { ssr: false })` in Server Components
- Phaser evaluiert `window` beim Modulimport → prerender schlägt fehl wenn Phaser auch nur transitiv in einem Server Component landet

**Fallstricke:**
- `app/page.tsx` als Server Component + direkter Import von `GameWrapper` → `window is not defined` beim Build
- `ssr: false` in Server Component → Build-Fehler `ssr: false is not allowed with next/dynamic in Server Components`
- Fix: `app/page.tsx` mit `'use client'` markieren, dann funktioniert `dynamic(() => ..., { ssr: false })` problemlos

**Nützliche Erkenntnisse:**
- `'use client'` auf `page.tsx` ist für reine Game-Pages völlig in Ordnung — kein SEO-Nachteil
- `import * as Phaser from 'phaser'` gibt Zugang zu `Phaser.Game`, `Phaser.Scene`, `Phaser.AUTO`, allen Types etc.
- Next.js modifiziert `tsconfig.json` beim ersten Build automatisch (fügt `target: ES2017` hinzu) — das ist erwartetes Verhalten
---

---
### [T002] Tile-Map Grundstruktur — 2026-05-09
**Was ich vorher hätte wissen sollen:**
- `scene.make.graphics()` API hat sich in Phaser 3.90 geändert — `{ add: false }` wird nicht mehr als Option akzeptiert
- `RenderTexture.draw(gfx, 0, 0)` erwartet, dass das Graphics-Objekt in der Scene ist (via `scene.add.graphics()`)

**Fallstricke:**
- `scene.make.graphics({ add: false })` → TypeScript-Fehler `'add' does not exist in type 'Options'`
- Fix: `scene.add.graphics()` + nach `rt.draw()` sofort `gfx.destroy()` aufrufen
- Start-Bereiche des Spielers und der KI müssen nach der Cluster-Generierung explizit freigeräumt werden, sonst landen Wasser/Berg-Cluster darüber

**Nützliche Erkenntnisse:**
- `RenderTexture` bäckt das gesamte Tile-Grid einmalig als Textur — kein Performance-Problem auch bei 40×30 Tiles
- Kamera-Bounds mit `this.cameras.main.setBounds()` verhindern Scrollen über Kartenrand ohne zusätzliche Logik
- WASD + Pfeiltasten parallel via `createCursorKeys()` + `addKey()` — beide funktionieren gleichzeitig
---

---
### [T003] Ressourcen-System — 2026-05-09
**Was ich vorher hätte wissen sollen:**
- Nahrung ist kein Karten-Node — sie wird durch Farmen produziert (T005). Daher `NODE_CONFIG` als `Record<Exclude<ResourceType, 'food'>, ...>` typen
- EventBus muss typensicher sein: `emit<Resources>('resources-updated', ...)` und `on<Resources>(...)` vermeiden Type-Casts an der Aufrufstelle

**Fallstricke:**
- `setResources` aus `useState` hat Typ `Dispatch<SetStateAction<Resources>>` → nicht direkt als `Callback<Resources>` übergeben, lokalen Handler als Wrapper verwenden
- Resource Nodes müssen nach Map-Generierung auf Walkability prüfen (Cluster können Grass-Tiles überschreiben)
- Abstand zu Startpunkten mit Manhattan-Distanz statt Euklidischer — einfacher, reicht für MVP

**Nützliche Erkenntnisse:**
- Phaser → React Kommunikation via EventBus funktioniert zuverlässig: `emit()` in Phaser Scene, `on()` in `useEffect` mit Cleanup
- `depleteNode()` zerstört das Graphics-Objekt direkt — kein Array-Rebuild nötig, Map-Lookup via `nodeId`
- Shadow-Effekt (dunkler Offset-Rect) auf Nodes macht sie visuell deutlicher auf der Karte
---

---
### [T004] Arbeiter-Einheit — 2026-05-09
**Was ich vorher hätte wissen sollen:**
- `Phaser.GameObjects.Container` hat eine eigene `moveTo(child, index)` Methode — eigene `moveTo()` Methode MUSS anders benannt werden (z.B. `setMoveTarget()`), sonst TypeScript-Signaturkonflikt
- Tap vs. Drag auf Mobile: pointerdown+pointerup mit Distanzschwelle (<15px) trennt sauber zwischen Tap (Selektion/Befehl) und Drag (Kamera)

**Fallstricke:**
- `Container.moveTo()` clash → TypeScript Error: rename zu `setMoveTarget()`
- Drag-Panning und Tap-Selection teilen dieselben Pointer-Events — Tap erst in `pointerup` auswerten, nicht in `pointerdown`
- `pop-changed` Event emittiert nur `count` (number), nicht `{ count, cap }` — HUD muss cap separat verwalten oder Event erweitern

**Nützliche Erkenntnisse:**
- Callback-Kette für Gather-Loop: `setMoveTarget → onArrived → gathering → gatherTick → setMoveTarget(base) → deposit → setMoveTarget(node) → ...` — sauber ohne Frame-Polling
- `scene.add.graphics()` + `container.add(gfx)` ist die korrekte Pattern für Container-Children in Phaser 3.90
- Selektion in `pointerup` statt `pointerdown` — vermeidet Konflikt mit Drag-Panning
---

---
### [T005] Gebäude-System — 2026-05-09
**Was ich vorher hätte wissen sollen:**
- Eine einzige `Building`-Klasse mit `buildingType` Property ist wesentlich einfacher als Abstract-Class-Hierarchie — kein Overhead, gleiche Funktionalität
- Passive Produktion braucht Float-Akkumulatoren: `metalAccum += 2 * delta/1000` dann `Math.floor()` — sonst wird bei 60fps jedes Frame ein Bruchteil emittiert aber nie ein ganzer Wert übertragen

**Fallstricke:**
- Gebäude-Platzierung auf Wasser/Berg: doppelte Prüfung nötig — `tile.walkable` UND `tile.type !== 'water'` (beides sollte gleich sein, aber defensive check)
- `BuildingSystem` als Map mit `"tileX,tileY"` Key macht `isTileOccupied` O(1) — wichtig für spätere Skalierung
- `building.built = true` muss VOR dem ersten `update()` der BuildingSystem für TownHall gesetzt werden — sonst startet passive Produktion nicht sofort

**Nützliche Erkenntnisse:**
- `tick(delta)` auf der Building-Klasse selbst (kennt eigene buildTime aus Config) ist sauberer als buildSpeed-Parameter
- Fortschrittsbalken am Gebäude in Phaser-Canvas statt React-Overlay — spart Event-Overhead
- `getBuildingAt(tileX, tileY)` über Tile-Koordinate statt Pixel macht Klick-Erkennung einfach und präzise
---

Format:
```
---
### [Ticket-ID] [Ticket-Titel] — [Datum]
**Was ich vorher hätte wissen sollen:**
- ...
**Fallstricke:**
- ...
**Nützliche Erkenntnisse:**
- ...
---
```
