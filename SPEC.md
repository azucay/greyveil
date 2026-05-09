# SPEC.md — Produkt- und Architektur-Referenz

## Vision

Greyveil ist ein Fantasy-RTS im Browser. Spieler baut eine Basis, sammelt Ressourcen, bildet Einheiten aus und besiegt KI-gesteuerte Gegner. Kernfeature: Hybrid-AI-Gegner — regelbasiert für Mikro-Steuerung der einzelnen Einheiten, Claude API für Makrostrategie (Expansion, Angriffsziele, Baustrategie).

---

## MVP Scope (v0.1)

**Enthalten:**
- 1 Skirmish-Karte (Tile-basiert, 2D, prozedural oder fest)
- Ressourcen: Holz, Stein, Nahrung, Metall, Gold
- Gebäude: Rathaus, Kaserne, Farm, Mine
- Einheiten: Arbeiter, Schwertkämpfer, Bogenschütze
- Fraktionen: Menschen (Spieler) vs. Orks (AI)
- AI-Gegner: regelbasiert (Mikro) + Claude API (Makro)
- Sieg/Niederlage-Bedingung (Rathaus zerstört = verloren)
- PWA-fähig (Mobile Browser)

**Out of Scope MVP:**
- Multiplayer / PvP
- Kampagne / Story-Modus
- Weitere Fraktionen
- Account-System / Savegames
- Echte Grafiken / externe Asset-Packs
- Sound / Musik

---

## Architektur

```
/app                        Next.js App Router
/app/api/ai/route.ts        Claude API Endpunkt (AI-Makrostrategie)
/game                       Phaser.js Game Engine
/game/scenes                Phaser Scenes (Boot, Preload, Game, UI)
/game/entities              Einheiten und Gebäude als Phaser-Klassen
/game/systems               Spielsysteme (Ressourcen, KI, Kampf)
/components                 React UI Komponenten (HUD, Menüs)
/public/assets              Leer im MVP — reserviert für Post-MVP
/tickets                    Ticket-Dokumentation
/types                      Geteilte TypeScript-Typen
```

### Phaser-Integration in Next.js

Phaser wird client-side initialisiert. Die Next.js-Seite (`app/page.tsx`) rendert einen `<div>` Container; Phaser mountet dort sein Canvas. Phaser-Import erfolgt dynamisch (`dynamic(() => import(...), { ssr: false })`), da Phaser nicht SSR-kompatibel ist.

---

## Ressourcen-System

| Ressource | Produziert durch | Verwendet für |
|---|---|---|
| Holz | Arbeiter sammelt von Holz-Tiles | Gebäude, einfache Einheiten |
| Stein | Arbeiter sammelt von Stein-Tiles | Gebäude (höherstufig) |
| Nahrung | Farm produziert passiv | Einheiten-Unterhalt (Pop-Cap) |
| Metall | Mine produziert passiv | Militäreinheiten |
| Gold | Mine (seltener Typ) produziert passiv | Upgrades, Claude-AI-Aktionen |

---

## Gebäude

| Gebäude | Kosten | Funktion |
|---|---|---|
| Rathaus | Startgebäude | Trainiert Arbeiter, Hauptgebäude (Sieg-Bedingung) |
| Kaserne | Holz + Stein | Trainiert Schwertkämpfer, Bogenschütze |
| Farm | Holz | Erhöht Nahrungs-Kapazität (Pop-Cap) |
| Mine | Holz + Stein | Produziert Metall und Gold |

---

## Einheiten

| Einheit | Trainiert in | Kosten | Rolle |
|---|---|---|---|
| Arbeiter | Rathaus | Holz | Sammelt Ressourcen, baut Gebäude |
| Schwertkämpfer | Kaserne | Metall + Nahrung | Nahkampf-Kämpfer |
| Bogenschütze | Kaserne | Holz + Metall | Fernkampf-Kämpfer |

---

## AI-Gegner: Hybrid-System

### Regelbasiertes Mikro
Phaser-internes System (AISystem.ts) steuert jede Einheit:
- Gegner-Einheiten angreifen wenn in Reichweite
- Ressourcen sammeln
- Rückzug bei niedrigen HP

### Claude API Makrostrategie

**Flow:**
```
GameScene (alle N Sekunden)
  → Spielzustand serialisieren (JSON)
  → POST /api/ai
  → Claude API (claude-sonnet-4-6)
  → Strategische Aktion zurück
  → AISystem führt Aktion aus
```

**API Endpunkt:** `POST /api/ai`

**Request Body:**
```typescript
{
  resources: { wood: number, stone: number, food: number, metal: number, gold: number },
  units: { workers: number, swordsmen: number, archers: number },
  buildings: { townhall: boolean, barracks: number, farms: number, mines: number },
  map_state: { explored_tiles: number, resource_nodes_controlled: number },
  player_activity: { units_lost: number, units_killed: number, buildings_lost: number }
}
```

**Response:**
```typescript
{
  action: "expand" | "attack_wood" | "attack_base" | "build_barracks" | "defend",
  reason: string
}
```

**Prompt-Struktur:**
Der System-Prompt instruiert Claude, als Ork-Stammesführer zu agieren. Der Makro-Zyklus wird alle 30 Sekunden ausgeführt (konfigurierbar). Claude-Entscheidungen werden gecacht falls identischer Spielzustand.

---

## Assets & Grafik-Strategie

### MVP: Geometric Placeholders

Alle visuellen Elemente werden mit der **Phaser.js Graphics API** als geometrische Formen gezeichnet. Kein externes Asset-Pack.

| Element | Form | Farbe (Hex) |
|---|---|---|
| Spieler-Einheiten | Kreis | #3B82F6 (Blau) |
| Gegner-Einheiten | Kreis | #EF4444 (Rot) |
| Rathaus | Rechteck (groß) | #374151 (Dunkelgrau) |
| Kaserne | Rechteck (mittel) | #92400E (Braun) |
| Farm | Rechteck (mittel) | #166534 (Dunkelgrün) |
| Mine | Rechteck (mittel) | #451A03 (Dunkelbraun) |
| Holz | Kleines Quadrat | #4ADE80 (Grün) |
| Stein | Kleines Quadrat | #9CA3AF (Grau) |
| Metall | Kleines Quadrat | #CBD5E1 (Silber) |
| Gold | Kleines Quadrat | #FCD34D (Gelb) |
| Gras-Terrain | Tile | #86EFAC (Hellgrün) |
| Wasser-Terrain | Tile | #60A5FA (Blau) |
| Berg-Terrain | Tile | #6B7280 (Grau) |

### Post-MVP: Asset Migration

Asset-Swap auf Kenney.nl Medieval Pack erfolgt in einem separaten Ticket nach MVP-Validierung. Da Placeholders in `/game/entities` und `/game/scenes` isoliert sind, ist kein Refactoring der Spiellogik nötig.

---

## Sieg / Niederlage

| Bedingung | Resultat |
|---|---|
| Spieler-Rathaus zerstört | Niederlage |
| Ork-Rathaus zerstört | Sieg |
| Alle Spieler-Einheiten und Gebäude vernichtet | Niederlage |

---

## PWA-Anforderungen

- `manifest.json` mit Icons, Theme-Color
- Service Worker für Offline-Grundfunktion (statische Assets)
- Responsive Viewport (Mobile Browser spielbar)
- Touch-Input-Support in Phaser (Tap = Klick, Pinch = Zoom)
