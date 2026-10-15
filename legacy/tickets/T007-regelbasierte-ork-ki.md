# [T007] Regelbasierte Ork-KI

## Ziel
Ein vollständiger AI-Gegner (Ork-Fraktion) existiert mit eigenem Startpunkt, eigenen Gebäuden und Einheiten. Die KI agiert nach Regelwerk: sammelt Ressourcen, baut Gebäude, trainiert Einheiten und greift an.

## Kontext
Das regelbasierte Mikro ist die Grundlage des KI-Gegners. Die Claude API Makrostrategie (T008) wird darauf aufgesetzt. Die KI muss eigenständig spielen können — T008 verbessert nur die strategischen Entscheidungen.

**Abhängigkeiten:** T001–T006 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] KI startet mit eigenem Rathaus (gegenüberliegende Ecke der Karte), 3 Ork-Arbeitern, 200 jeder Ressource
- [ ] KI-Einheiten dargestellt in Rot (#EF4444), Gebäude mit rotem Overlay
- [ ] KI-Arbeiter sammeln Ressourcen automatisch (gleiche Logik wie Spieler-Arbeiter)
- [ ] KI-Bau-Priorität: Farm → Mine → Kaserne (wenn Ressourcen reichen)
- [ ] KI trainiert Schwertkämpfer sobald Kaserne vorhanden und Ressourcen reichen
- [ ] KI greift an sobald 3+ Kampfeinheiten vorhanden: Gruppe bewegt sich zum Spieler-Rathaus
- [ ] KI-Einheiten kämpfen automatisch: nächstgelegenen Feind in Reichweite angreifen
- [ ] KI-Einheiten weichen nicht zurück (aggressive Mikro-Logik)
- [ ] KI sammelt Ressourcen kontinuierlich parallel zum Kämpfen
- [ ] KI baut neue Einheiten auch wenn Angriff läuft
- [ ] KI-Aktionen laufen im Phaser `update()`-Loop, kein externer API-Call in diesem Ticket

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T006 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Spiel starten, KI baut eigenständig Basis auf, greift nach ca. 2–3 Minuten an
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**AISystem Klasse (`/game/systems/AISystem.ts`):**
```typescript
class AISystem {
  private scene: GameScene
  private faction: 'ai'

  update(delta: number): void {
    this.manageMicro(delta)    // Einheiten-Steuerung
    // Makro wird in T008 via Claude API ergänzt
  }

  private manageMicro(delta: number): void {
    this.manageWorkers()
    this.manageBuilding()
    this.manageTraining()
    this.manageCombat()
  }
}
```

**Mikro-Entscheidungsbaum:**
```
Jede Einheit pro Frame:
├── State == idle?
│   ├── Kampfeinheit → nächsten Feind suchen → angreifen oder Rathaus angreifen
│   └── Arbeiter → nächsten Ressourcen-Node suchen → sammeln
├── State == attacking?
│   └── Feind tot? → idle
└── State == moving?
    └── Ziel erreicht? → idle oder attacking
```

**Gebäude-Entscheidung (alle 5 Sekunden):**
```
Wenn keine Farm → Farm bauen (Kosten verfügbar?)
Sonst wenn keine Mine → Mine bauen
Sonst wenn keine Kaserne → Kaserne bauen
```

**Angriffs-Trigger:**
KI zählt eigene Kampfeinheiten. Ab 3 Einheiten: Alle Kampfeinheiten bekommen `target = playerTownHall`. Mikro kämpft unterwegs gegen alles in Reichweite.

**Performance:**
KI-Entscheidungen nicht jeden Frame — Bau/Training alle 5s via `time.addEvent`, Mikro jede 200ms.
