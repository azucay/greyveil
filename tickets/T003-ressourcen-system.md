# [T003] Ressourcen-System

## Ziel
Ressourcen-Nodes (Holz, Stein, Metall, Gold) existieren auf der Karte als farbige Quadrate. Das Ressourcen-System verwaltet Spieler- und KI-Bestände. Ein HUD zeigt die aktuellen Ressourcen des Spielers an.

## Kontext
Ressourcen sind die Grundlage für Gebäude (T005) und Einheiten. Das Sammeln durch Arbeiter wird in T004 implementiert — dieses Ticket legt nur die Datenstruktur, Nodes auf der Karte und das HUD an.

**Abhängigkeiten:** T001, T002 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Vier Ressourcen-Typen definiert: `wood`, `stone`, `metal`, `gold`
- [ ] Ressourcen-Nodes auf der Karte platziert (nur auf begehbaren Gras-Tiles, nicht überlappend mit Startgebäuden)
- [ ] Darstellung als farbige Quadrate (20×20px): Holz=#4ADE80, Stein=#9CA3AF, Metall=#CBD5E1, Gold=#FCD34D
- [ ] Jeder Node hat eine `amount`-Property (z.B. 500 Holz, 300 Stein)
- [ ] `ResourceSystem` Klasse verwaltet Spieler-Bestände und KI-Bestände getrennt
- [ ] Methoden: `add(type, amount)`, `subtract(type, amount)`, `canAfford(cost: ResourceCost)`
- [ ] React HUD-Komponente zeigt Spieler-Ressourcen oben im Browser an (Nahrung, Holz, Stein, Metall, Gold)
- [ ] HUD aktualisiert sich in Echtzeit (Phaser → React Kommunikation via EventEmitter oder Zustand)

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001 und T002 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Ressourcen-Nodes auf Karte sichtbar, HUD zeigt korrekte Startwerte, `canAfford` gibt korrekte Ergebnisse in Browser-Console
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**TypeScript-Typen (in `/types/resources.ts`):**
```typescript
export type ResourceType = 'wood' | 'stone' | 'food' | 'metal' | 'gold'

export interface Resources {
  wood: number
  stone: number
  food: number
  metal: number
  gold: number
}

export interface ResourceCost extends Partial<Resources> {}

export interface ResourceNode {
  id: string
  type: ResourceType
  amount: number
  x: number  // Tile-Koordinate
  y: number
  depleted: boolean
}
```

**Phaser ↔ React Kommunikation:**
Phaser-Events über einen globalen EventEmitter weiterleiten. In `app/page.tsx` oder dem HUD-Komponenten auf Events hören:
```typescript
// In Phaser
this.events.emit('resources-updated', playerResources)
// In React (via ref auf Phaser-Game-Instanz)
game.events.on('resources-updated', setResources)
```

**Ressourcen-Node Platzierung:**
Mindestabstand von 5 Tiles zum Spieler-Startpunkt und 5 Tiles zum KI-Startpunkt. Nodes nicht auf Wasser oder Berg-Tiles platzieren.

**Nahrung:**
Nahrung ist kein Node auf der Karte — sie wird durch Farmen passiv produziert (T005). Startwert: 50 Nahrung für beide Seiten.
