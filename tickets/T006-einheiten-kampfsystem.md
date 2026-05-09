# [T006] Einheiten-Kampfsystem

## Ziel
Kampfeinheiten (Schwertkämpfer, Bogenschütze) können in der Kaserne trainiert werden. Einheiten greifen gegnerische Einheiten und Gebäude an. Kampf ist turnbasiert auf Tick-Basis mit Schaden, HP und Tod.

## Kontext
Das Kampfsystem ist die Grundlage für den gesamten Konflikt zwischen Spieler und KI-Gegner. Ohne Kampf gibt es keinen Sieg oder Niederlage.

**Abhängigkeiten:** T001–T005 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Schwertkämpfer trainierbar in Kaserne: Kosten 50 Metall + 20 Nahrung, Trainingszeit 15s
- [ ] Bogenschütze trainierbar in Kaserne: Kosten 30 Holz + 30 Metall, Trainingszeit 12s
- [ ] Schwertkämpfer: HP=100, Schaden=15, Nahkampf-Reichweite=1.5 Tiles, Geschwindigkeit=80px/s
- [ ] Bogenschütze: HP=70, Schaden=20, Fernkampf-Reichweite=5 Tiles, Geschwindigkeit=70px/s
- [ ] Darstellung: Spieler-Einheiten blau (#3B82F6), KI-Einheiten rot (#EF4444), Kreis Radius 10px
- [ ] HP-Balken über jeder Einheit (grüner Balken, rot wenn <30%)
- [ ] Angriff: Einheit in Reichweite → Schaden pro Sekunde (kein Cooldown-System nötig, Tick-basiert)
- [ ] Tod: Einheit verschwindet bei HP <= 0
- [ ] Spieler kann Einheiten auswählen (Klick) und angreifen lassen (Rechtsklick auf Feind)
- [ ] Einheiten können mehrfach ausgewählt werden (Box-Selection mit Drag)
- [ ] Angriff auf feindliche Gebäude möglich (Gebäude haben HP)
- [ ] Gebäude zerstörbar (HP <= 0 → Gebäude verschwindet)

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T005 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Schwertkämpfer und Bogenschütze trainieren, beide kämpfen gegen Test-Dummy-Einheit, HP-Balken korrekt, Tod funktioniert
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Einheiten als Phaser-Klassen:**
```typescript
abstract class Unit extends Phaser.GameObjects.Container {
  hp: number
  maxHp: number
  damage: number
  range: number  // in Tiles
  speed: number  // px/s
  faction: 'player' | 'ai'
  state: 'idle' | 'moving' | 'attacking' | 'dead'
  target: Unit | Building | null
}

class Swordsman extends Unit { ... }
class Archer extends Unit { ... }
```

**Kampf-Loop:**
Im `GameScene.update()` pro Frame: Für jede Einheit im `attacking`-State prüfen ob Ziel in Reichweite → `target.takeDamage(this.damage * delta / 1000)`.

**Box-Selection:**
```typescript
// Drag-Rectangle aufzeichnen
this.input.on('pointermove', ...)
// Bei Pointer-Up: alle Units im Rechteck selektieren
this.unitGroup.getChildren().filter(unit =>
  Phaser.Geom.Rectangle.Contains(selectionRect, unit.x, unit.y)
)
```

**HP-Balken:**
`Phaser.GameObjects.Graphics` direkt auf der Einheit (als Container-Kind). Breite proportional zu `hp / maxHp`, Farbe wechselt bei <30% auf Rot.

**Bogenschütze Distanz:**
Bogenschützen greifen aus der Ferne an. Wenn Ziel in Reichweite, bleibt Bogenschütze stehen und greift an. Bei Nahkampf-Feind der sich nähert: Bogenschütze weicht zurück (retreat-Logik).
