# [T002] Tile-Map Grundstruktur

## Ziel
Die Spielwelt besteht aus einem Tile-Grid, das im Browser sichtbar ist. Verschiedene Terrain-Typen (Gras, Wasser, Berg) sind als farbige Rechtecke mit der Phaser Graphics API gerendert. Die Kamera lässt sich über die Karte bewegen.

## Kontext
Ohne Tile-Map gibt es keine Spielwelt. Alle späteren Systeme (Ressourcen T003, Einheiten T004, Gebäude T005) benötigen eine positionierbare Karte als Grundlage.

**Abhängigkeiten:** T001 muss abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Karte ist mindestens 40×30 Tiles groß
- [ ] Tile-Größe: 32×32 Pixel (konfigurierbar als Konstante)
- [ ] Drei Terrain-Typen vorhanden: Gras (#86EFAC), Wasser (#60A5FA), Berg (#6B7280)
- [ ] Karte wird prozedural oder aus einer fest definierten Array-Struktur geladen
- [ ] Wasser und Berg-Tiles sind nicht begehbar (walkable: false)
- [ ] Gras-Tiles sind begehbar (walkable: true)
- [ ] Kamera-Scrolling mit WASD oder Pfeiltasten implementiert
- [ ] Kamera ist auf Karten-Grenzen begrenzt (kein Scroll über den Rand hinaus)
- [ ] Tile-Grid ist als TypeScript-Typ definiert (`TileType`, `Tile`, `GameMap`)
- [ ] Karten-Daten sind in `/game/systems/` oder `/game/scenes/` als eigene Klasse/Modul isoliert

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Karte sichtbar, drei Terrain-Typen erkennbar, Kamera scrollt korrekt
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Phaser Graphics API für Tiles:**
Jedes Tile wird als `Phaser.GameObjects.Graphics`-Rechteck gerendert. Für Performance-Optimierung: alle Tiles in eine `Phaser.GameObjects.RenderTexture` backen — einmalig beim Start, nicht jeden Frame neu zeichnen.

**TypeScript-Typen (in `/types/map.ts`):**
```typescript
export type TileType = 'grass' | 'water' | 'mountain'

export interface Tile {
  type: TileType
  walkable: boolean
  x: number  // Tile-Koordinate (nicht Pixel)
  y: number
}

export type GameMap = Tile[][]
```

**Kamera-Bounds:**
```typescript
this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
```

**Karten-Generierung:**
Eine einfache Zufalls-Karte mit ~70% Gras, ~15% Wasser, ~15% Berg reicht für MVP. Wasser und Berge sollten in Clustern liegen (kein reines Noise), damit die Karte spielbar ist. Alternativ: Fest definiertes 2D-Array.

**TILE_SIZE Konstante:**
Definiere `TILE_SIZE = 32` als globale Konstante in `/game/constants.ts`.
