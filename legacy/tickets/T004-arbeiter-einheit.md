# [T004] Arbeiter-Einheit

## Ziel
Der Spieler kann Arbeiter-Einheiten auswählen und zu Ressourcen-Nodes schicken. Arbeiter sammeln Ressourcen automatisch und bringen sie zum Rathaus zurück. Das Rathaus trainiert neue Arbeiter gegen Ressourcenkosten.

## Kontext
Die Arbeiter-Einheit ist die erste spielbare Einheit und schafft den grundlegenden Gameplay-Loop: Ressourcen sammeln → Gebäude bauen. Ohne Arbeiter kann der Spieler keine Basis aufbauen.

**Abhängigkeiten:** T001, T002, T003 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Arbeiter dargestellt als blauer Kreis (Radius 8px, #3B82F6) auf der Karte
- [ ] Spieler startet mit 3 Arbeitern beim Rathaus-Startpunkt
- [ ] Klick auf Arbeiter = Einheit auswählen (visuelles Feedback: weißer Ring)
- [ ] Rechtsklick auf Ressourcen-Node = Arbeiter bewegt sich dorthin und beginnt zu sammeln
- [ ] Sammeln: Arbeiter bleibt am Node, `amount` des Nodes sinkt pro Tick, Spieler-Ressourcen steigen
- [ ] Nach Sammeln: Arbeiter kehrt automatisch zum Rathaus zurück und gibt Ressourcen ab
- [ ] Erschöpfter Node (`amount <= 0`): Node verschwindet, Arbeiter wird idle
- [ ] Rathaus-UI: Klick auf Rathaus öffnet Trainings-Panel mit "Arbeiter trainieren" Button (Kosten: 50 Holz)
- [ ] Training dauert 10 Sekunden (Fortschrittsbalken als Phaser Graphics Rechteck)
- [ ] Maximale Bewegungsgeschwindigkeit als Konstante konfigurierbar
- [ ] Bewegung nutzt einfaches Pathfinding (direkter Pfad auf begehbaren Tiles, kein komplexes A*)

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001, T002, T003 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Arbeiter auswählen, zu Node schicken, Ressourcen steigen im HUD, neuer Arbeiter trainieren
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Arbeiter als Phaser-Klasse:**
```typescript
class Worker extends Phaser.GameObjects.Container {
  state: 'idle' | 'moving' | 'gathering' | 'returning'
  targetNode: ResourceNode | null
  carryAmount: number
  carryType: ResourceType | null
}
```

**Einfaches Pathfinding:**
Für MVP: Tile-basiertes Pathfinding mit A* oder einfachem direktem Pfad via `Phaser.Math.Distance`. Wasser und Berg-Tiles werden umgangen (als `walkable: false` markiert). Wenn A* zu komplex, kann direktes Bewegen zum Ziel-Pixel mit Kollisions-Check ausreichen.

**Sammeln-Mechanik:**
- Sammel-Rate: 10 Ressourcen pro Sekunde (konfigurierbar)
- Trage-Kapazität: max. 30 Ressourcen (dann automatisch zurück zum Rathaus)
- Rückweg: Einheit bewegt sich zu Rathaus-Position, gibt Ressourcen ab, kehrt zum Node zurück

**Click-Handling:**
```typescript
// Pointer-Down auf Einheit
worker.setInteractive()
worker.on('pointerdown', () => this.selectUnit(worker))
// Pointer-Down auf Karte (Rechtsklick)
this.input.on('pointerdown', (pointer) => {
  if (pointer.rightButtonDown() && selectedUnit) { ... }
})
```

**Rathaus-UI:**
Einfaches React-Overlay oder Phaser UIScene-Overlay. Beim Klick auf das Rathaus-Gebäude wird ein Panel gezeigt mit Trainings-Button.
