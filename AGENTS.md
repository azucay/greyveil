# AGENTS.md — Operativer Guide für Greyveil

## Projekt-Übersicht

Greyveil ist ein Mobile-first Fantasy-RTS im Stil von Warcraft 2, das im Browser läuft (PWA). Spieler bauen eine Basis, sammeln Gold und Holz, bilden Einheiten aus und besiegen eine regelbasierte KI („die Rote Horde“). Die Partien sollen kurz sein (8–12 Minuten), die Steuerung ist für Touch gebaut, und der Look ist „Modern Retro“: prozedurale Pixel-Art mit gedämpfter, erdiger Palette.

**Design-Säulen**
1. **Steuerung zuerst.** Kontext-Tap, Lasso per Long-Press, Pinch-Zoom und große Daumen-Buttons.
2. **Look.** Pixel-Sprites mit Kontur, weicher Nebel des Krieges und Vignette, „nicht zu bunt“.
3. **Mobiler Spaß.** Kurze Runden, haptisches und visuelles Feedback, wenig Mikro-Management (Auto-Sammeln, Auto-Angriff).

---

## Tech Stack

| Technologie | Zweck |
|---|---|
| Vite 6 | Dev-Server und Build (statische Seite, keine Server-Komponente) |
| Phaser 3.90 | Rendering, Kamera, Input, Tweens |
| TypeScript (strict) | gesamter Code |
| DOM + CSS | HUD (scharfer Text, Safe-Area, große Buttons) |
| WebAudio | synthetische Sounds (keine Audio-Dateien) |
| @fontsource/pixelify-sans | Pixel-Font, gebündelt, damit sie offline funktioniert |
| Vercel | Hosting (`vercel.json` → Framework `vite`, Output `dist`) |

**Bewusst entfernt:** Next.js, React, Tailwind und die Claude-API-KI. Für ein reines Canvas-Spiel waren sie nur Overhead. Der alte Stand liegt unter `/legacy` und kann gelöscht werden.

---

## Verzeichnisstruktur

```
index.html            HUD-Markup + Screens (Start, Pause, Spielende)
src/
  main.ts             Phaser-Game, Screen-Flow, Service Worker
  config.ts           ALLE Balance-Werte, Palette, KI-Profile
  style.css           HUD- und Screen-Styles (Hoch- und Querformat)
  world/
    Grid.ts           Terrain, Kartengenerator, A* (Binary Heap), findFree
    Entities.ts       Unit, Building, Mine, Order-Typen
    World.ts          Simulation: Wirtschaft, Bewegung, Kampf, Sicht, Events
    AI.ts             Regelbasierte Gegner-KI (Leicht/Normal/Schwer)
  scenes/GameScene.ts Rendering-Sync, Nebel, Gesten, Auswahl, Bauplatzierung
  gfx/Textures.ts     Prozedurale Pixel-Sprites (Canvas → Phaser-Texturen)
  gfx/Fx.ts           Partikel, Projektile, Pings, schwebender Text, Shake
  ui/Hud.ts           DOM-HUD: Ressourcen, Panel, Schnellzugriffe, Minimap
  audio/Sfx.ts        WebAudio-Synth + Vibration
public/               manifest, sw.js, Icons
```

---

## Befehle

```
npm install
npm run dev        # Vite mit --host → auf dem Handy im selben WLAN testbar
npm run build      # tsc + vite build → dist/
npm run typecheck
```

---

## Steuerung (Referenz)

| Geste | Wirkung |
|---|---|
| Tap auf eigene Einheit | auswählen |
| Doppeltipp auf Einheit | alle Einheiten dieses Typs im Bild auswählen |
| Long-Press + Ziehen | Auswahlrahmen (wenn Kämpfer im Rahmen sind, werden nur diese gewählt) |
| Tap mit Auswahl | Kontextbefehl: Boden = Angriffsbewegung, Gegner = Angriff, Mine/Wald = sammeln, Baustelle = mitbauen |
| Gebäude gewählt + Tap | Sammelpunkt setzen (auf Mine/Wald sammeln neue Arbeiter automatisch) |
| 1 Finger wischen / 2 Finger | Kamera bewegen / Pinch-Zoom |
| Desktop | Rechtsklick = Befehl, Mausrad = Zoom |
| `1×/2×` in der Leiste oben | Spieltempo umschalten |

---

## Coding Conventions

- **TypeScript strict**, kein `any`, kein `@ts-ignore`.
- **Balance nur in `config.ts`**, keine Magic Numbers in der Spiellogik.
- Die Simulation (`World`) kennt keine HUD- oder Eingabe-Logik. Die Kommunikation läuft über `world.on(...)`-Events (`res`, `msg`, `over`, `attacked`, `died`).
- Das HUD ist DOM, nicht Phaser: Text bleibt scharf und Safe-Area/Media-Queries funktionieren.
- Keine externen Assets: Alle Grafiken entstehen in `gfx/Textures.ts`. Neue Sprites werden auf ein 16-px-Raster gezeichnet und mit `outline()` umrandet.
- Imports über den `@/`-Alias (→ `src/`).
- UI-Texte auf Deutsch.

---

## Bekannte Fallstricke

- `import * as Phaser from 'phaser'` verwenden (Phaser hat keinen Default-Export).
- `game.scene.start()` kann **synchron** `create()` ausführen. Callbacks wie `GameScene.onReady` deshalb vorher setzen.
- Kamera-Mathe: Für Pinch-Anker `toWorld()` in `GameScene` nutzen, nicht `cam.getWorldPoint`. Dessen Matrix ist direkt nach `setZoom` veraltet.
- Separation zwischen Einheiten muss schwächer sein als die Laufgeschwindigkeit, und Arbeiter kollidieren untereinander nicht. Sonst blockiert Gegenverkehr in 1-Tile-Korridoren dauerhaft.
- `walkTo`: Wer schon im Ziel-Rechteck steht, ist angekommen, auch mit Restpfad. Sonst schieben sich mehrere Einheiten endlos um denselben Tile-Mittelpunkt.
- Kein Pfad gefunden → nach 1 s erneut versuchen (`repathIn`). Blockaden lösen sich, wenn Bäume fallen.

---

## Workflow

1. Änderung umsetzen → `npm run build` muss grün sein.
2. Smoke-Test im Browser (Playwright-Skript oder Handy).
3. Learning unten eintragen.
4. Commit + Push.

Debug-Zugriff im Browser: `window.__greyveil.scene()` liefert die GameScene (`.world`, `.ai`). Für Balance-Tests lässt sich die Simulation per `world.update(0.05)` in einer Schleife vorspulen.

---

## Learnings

---
### [v0.2] Neustart: Vite + Phaser, Mobile-first — 2026-10-15
**Was ich vorher hätte wissen sollen:**
- Für ein Canvas-Spiel bringt Next.js nichts. Vite + Phaser ist schlanker und baut schneller, und Vercel deployed es mit `vercel.json` problemlos.
- Ein DOM-HUD über dem Canvas ist auf Mobile deutlich besser als Phaser-Text (Schärfe, Safe-Area, Layout per CSS).
**Fallstricke:**
- `scene.start()` lief synchron, deshalb kam das HUD-Callback zu spät (HUD blieb unsichtbar).
- KI hortete Gold, weil alle Arbeiter auf Gold liefen. Ohne Holz gab es keine Farm und damit Pop-Cap. Lösung: Zuteilung mitzählen plus aktives Umverteilen.
- Minen direkt am Rathaus machten die Wirtschaft absurd schnell. Mindestabstand über das `ok`-Prädikat in `findFree`.
**Nützliche Erkenntnisse:**
- Nebel als winzige Canvas-Textur (1 px pro Tile) mit LINEAR-Filter, hochskaliert, ergibt weiche Ränder fast kostenlos.
- Pixel-Kontur automatisch per `getImageData` macht aus simplen Rechtecken lesbare Sprites.
- Headless-Balance-Test: KI gegen passiven Spieler. Normal gewinnt nach ca. 7 Minuten, das ist ein guter Richtwert.
---

---
### [v0.3] Forschung, Tempo, Ziele, Statistik — 2026-10-15
**Was ich vorher hätte wissen sollen:**
- Upgrades wirken über `world.atk(u)` und `world.armor(t)`. Neue Schadensquellen müssen diese Helfer nutzen, nicht `stats.dmg` direkt.
**Fallstricke:**
- Für Tempo 2× laufen zwei Simulationsschritte pro Frame statt doppeltem `dt`. Das hält Bewegung und Kollision stabil.
**Nützliche Erkenntnisse:**
- Eine Ziel-Leiste (`Hud.updateGoal`) ersetzt ein Tutorial und kostet fast nichts. Neue Ziele kommen einfach ins Array.
- `world.stats` zählt Sammeln, Ausbildung, Kills und Verluste je Fraktion. Der Spielende-Screen nutzt das.
---

---
### [v0.4] Playtest-Feedback: Bau-Buttons, Leicht, Lesbarkeit — 2026-10-19
**Was ich vorher hätte wissen sollen:**
- Pixel-Fonts sind nur für Überschriften und Zahlen gut lesbar. Fließtext, Kosten und Hinweise laufen deshalb in System-Sans (`--sans`).
**Fallstricke:**
- Die ✓/✕-Buttons (`#place-ctl`) werden jeden Frame per `transform` neben den Bau-Geist gesetzt (`Hud.followPlacement`) und am Bildrand geklemmt.
**Nützliche Erkenntnisse:**
- Leicht wird über `armyReserve` gebremst: Goldpolster, Warteschlange 1 und kein vorgezogener Angriff. Gegen einen passiven Spieler gewinnt Leicht nach ca. 9 Minuten, Normal nach ca. 6.
---

Format:
```
---
### [Ticket-ID] [Titel] — [Datum]
**Was ich vorher hätte wissen sollen:**
- ...
**Fallstricke:**
- ...
**Nützliche Erkenntnisse:**
- ...
---
```
