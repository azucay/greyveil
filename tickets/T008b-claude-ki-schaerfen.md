# [T008b] Claude KI Makrostrategie schärfen

## Problem

Die aktuelle T008-Integration sendet nur 5 Zahlen an Claude (Soldatenanzahl, Workeranzahl, Kaserne vorhanden, aktuelle Strategie). Claude gibt lediglich "gather" / "build" / "attack" zurück — dasselbe was die Regellogik aus T007 ohnehin entscheidet. Echter Mehrwert ist nicht erkennbar.

## Ziel

Claude trifft echte, nicht-triviale strategische Entscheidungen auf Basis des vollständigen Spielzustands und gibt konkrete Aktionen zurück, die die Regellogik allein nicht treffen würde.

## Verbesserungen

### 1. Vollständiger Spielzustand als Kontext

```typescript
{
  turn: number,               // Spielzeit in Sekunden
  ai: {
    resources: Resources,     // Holz, Stein, Metall, Gold, Nahrung
    workers: number,
    soldiers: { swordsman: number, archer: number },
    buildings: { townhall: boolean, barracks: boolean, farm: number, mine: number },
  },
  player: {
    resources: Resources,
    workers: number,
    soldiers: number,
    buildings: string[],      // Gebäudetypen des Spielers
  },
  map: {
    resourceNodesLeft: number,
    nearestNodeToAI: { type: string, distance: number } | null,
  }
}
```

### 2. Konkretere Aktionen

Statt nur Strategie-Label, konkrete Aktion zurückgeben:

```json
{
  "action": "build_farm" | "build_barracks" | "train_archer" | "train_swordsman" | "attack_now" | "gather",
  "priority": "high" | "medium" | "low",
  "reason": "Ressourcenknappheit bei Nahrung, Farm hat Vorrang vor Kaserne"
}
```

### 3. Mehrere Turns Kontext (Memory)

Letzte 3 Claude-Antworten im Request mitschicken damit Claude Trends erkennen kann:

```json
{
  "history": [
    { "action": "gather", "tick": 30 },
    { "action": "build_barracks", "tick": 60 },
    { "action": "train_swordsman", "tick": 90 }
  ],
  "current": { ... }
}
```

### 4. UI-Indikator

Kleines "KI: [Strategie]" Label in der HUD oder im Spielfeld anzeigen damit der Spieler sehen kann was die KI plant.

### 5. Prompt-Optimierung

System-Prompt mit Spielregeln, Ressourcenkosten und Einheitenstatistiken anreichern damit Claude fundierte Entscheidungen trifft ohne die Kosten raten zu müssen.

## Akzeptanzkriterien

- Claude empfiehlt Aktionen die die Regellogik allein nicht treffen würde (z.B. Bogenschützen statt Schwertkämpfer bei hohem Holzbestand)
- Entscheidungen sind im HUD sichtbar
- Kein merklicher Performance-Einbruch durch größeren Kontext (Prompt Caching bleibt aktiv)

## Abhängigkeiten

- T007 (Regelbasierte KI) abgeschlossen ✓
- T008 (Claude API Basis) abgeschlossen ✓
- ANTHROPIC_API_KEY muss in .env.local / Vercel gesetzt sein
