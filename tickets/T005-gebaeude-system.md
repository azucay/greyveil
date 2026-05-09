# [T005] Gebäude-System

## Ziel
Der Spieler kann Gebäude (Kaserne, Farm, Mine) durch Arbeiter errichten. Gebäude haben ihre jeweiligen Funktionen: Farm erhöht Pop-Cap, Mine produziert Metall/Gold passiv, Kaserne trainiert Kampfeinheiten.

## Kontext
Gebäude schließen den wirtschaftlichen Gameplay-Loop aus Phase 1. Mit Gebäuden kann der Spieler seine Kapazitäten ausbauen und sich auf Phase 2 (Kampf, KI) vorbereiten.

**Abhängigkeiten:** T001, T002, T003, T004 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Rathaus existiert als Startgebäude (fest platziert, dunkelgrau #374151, 48×48px Rechteck)
- [ ] Kaserne baubar (braun #92400E, 40×40px): Kosten 100 Holz + 80 Stein, Bauzeit 20s
- [ ] Farm baubar (dunkelgrün #166534, 36×36px): Kosten 60 Holz, Bauzeit 15s, +50 Nahrungs-Cap
- [ ] Mine baubar (dunkelbraun #451A03, 40×40px): Kosten 80 Holz + 60 Stein, Bauzeit 20s
- [ ] Farm produziert passiv: +5 Nahrung/Sekunde bis Nahrungs-Cap
- [ ] Mine produziert passiv: +2 Metall/Sekunde, +0.5 Gold/Sekunde
- [ ] Bau-Modus: Klick auf "Bauen"-Button → Arbeiter auswählen → Ziel-Tile klicken → Bau beginnt
- [ ] Während Bau: Gebäude-Placeholder (halbe Transparenz) an Bau-Position, Fortschrittsbalken
- [ ] Gebäude nicht auf Wasser/Berg-Tiles baubar
- [ ] Gebäude nicht überlappend baubar (Kollisions-Check)
- [ ] Pop-Cap-System: Maximale Einheitenzahl = Basis 10 + 10 pro Farm. Überschreiten nicht möglich.
- [ ] Kaserne öffnet Trainings-Panel (Schwertkämpfer, Bogenschütze) — Training selbst in T006

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T004 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Farm bauen, Nahrung steigt; Mine bauen, Metall/Gold steigen; Kaserne bauen
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Gebäude als Phaser-Klasse:**
```typescript
abstract class Building extends Phaser.GameObjects.Container {
  faction: 'player' | 'ai'
  hp: number
  maxHp: number
  built: boolean
  buildProgress: number  // 0–1
}

class Barracks extends Building { ... }
class Farm extends Building { ... }
class Mine extends Building { ... }
class TownHall extends Building { ... }
```

**Passive Produktion:**
Farm und Mine nutzen Phaser `time.addEvent` mit 1000ms Intervall. Produktion nur wenn `built === true`.

**Bau-Logik:**
Arbeiter bewegt sich zur Bau-Position → `state = 'building'` → `buildProgress` steigt pro Tick → bei 1.0 ist Gebäude fertig (`built = true`), volle Deckkraft.

**Orki-Fraktion:**
KI-Gebäude sind funktional identisch, aber mit roter Färbung (#EF4444 statt Spieler-Farbe). Werden in T007 platziert.

**Gebäude-Registry:**
`BuildingSystem` hält eine Map aller Gebäude nach Tile-Koordinate, damit Kollisions-Check O(1) ist.
