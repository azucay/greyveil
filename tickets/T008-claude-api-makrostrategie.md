# [T008] Claude API Makrostrategie

## Ziel
Der KI-Gegner konsultiert alle 30 Sekunden die Claude API für seine Makrostrategie. Claude analysiert den Spielzustand und gibt eine strategische Aktion zurück, die das regelbasierte AI-System ausführt.

## Kontext
Das Kern-Differenzierungsmerkmal von Greyveil. Die regelbasierte KI (T007) kümmert sich um Mikro. Claude übernimmt Makro-Entscheidungen (Expansion, Angriffsziele, Bau-Prioritäten). Das macht den KI-Gegner unberechenbar und interessant.

**Abhängigkeiten:** T001–T007 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Next.js API Route `POST /api/ai` implementiert
- [ ] Route serialisiert Spielzustand und sendet ihn an Claude API (claude-sonnet-4-6)
- [ ] System-Prompt definiert Claude als "Urgok, Ork-Stammesführer" mit strategischem Auftrag
- [ ] Response-Schema strict validiert: `{ action, reason }` — keine anderen Felder
- [ ] Gültige Aktionen: `"expand" | "attack_wood" | "attack_base" | "build_barracks" | "defend"`
- [ ] `AISystem` ruft `/api/ai` alle 30 Sekunden (konfigurierbar) via `fetch()`
- [ ] Claude-Aktion wird in regelbasiertes Verhalten übersetzt (z.B. `attack_base` → Angriffsziel = Spieler-Rathaus)
- [ ] Fehlerfall (API-Timeout, Fehler): KI fällt auf letzten bekannten Befehl zurück, kein Crash
- [ ] `ANTHROPIC_API_KEY` wird aus `.env.local` gelesen, nie im Client-Code exponiert
- [ ] Rate-Limiting: Maximal 1 Request alle 30 Sekunden, kein Request wenn vorheriger noch läuft
- [ ] Prompt-Caching genutzt (System-Prompt als cached_content)

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T007 abgeschlossen
- [ ] `ANTHROPIC_API_KEY` ist als Environment Variable verfügbar

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Console-Log zeigt Claude-Aktionen alle 30s; KI ändert Verhalten basierend auf Aktion
- [ ] API Key ist niemals im Client-Bundle (Vercel Build prüfen)
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**API Route (`/app/api/ai/route.ts`):**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: Request) {
  const gameState = await request.json()
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: SYSTEM_PROMPT,  // cached
    messages: [{ role: 'user', content: JSON.stringify(gameState) }],
  })
  
  // Parse und validiere Response
  const action = parseAction(response.content[0])
  return Response.json(action)
}
```

**System-Prompt:**
```
Du bist Urgok, Anführer des Ork-Stammes in Greyveil. 
Analysiere den Spielzustand und gib EXAKT eine der folgenden Aktionen zurück als JSON:
{ "action": "expand" | "attack_wood" | "attack_base" | "build_barracks" | "defend", "reason": "Kurze Begründung" }

expand: Mehr Ressourcen-Nodes kontrollieren
attack_wood: Spieler-Holz-Arbeiter angreifen
attack_base: Direkt das Rathaus angreifen
build_barracks: Mehr Kasernen bauen und Einheiten trainieren
defend: Basis verteidigen, keine Angriffe
```

**Request Body (GameState):**
```typescript
interface AIGameState {
  resources: { wood: number, stone: number, food: number, metal: number, gold: number }
  units: { workers: number, swordsmen: number, archers: number }
  buildings: { townhall: boolean, barracks: number, farms: number, mines: number }
  map_state: { explored_tiles: number, resource_nodes_controlled: number }
  player_activity: { units_lost: number, units_killed: number, buildings_lost: number }
}
```

**Aktion → Verhalten Mapping in AISystem:**
```typescript
switch (action) {
  case 'expand': this.sendWorkersToNewNodes(); break
  case 'attack_wood': this.targetPlayerWorkers(); break
  case 'attack_base': this.targetPlayerTownHall(); break
  case 'build_barracks': this.prioritizeBarracks(); break
  case 'defend': this.recallAllUnits(); break
}
```

**Sicherheit:**
`ANTHROPIC_API_KEY` nur in `.env.local` (nie `.env.public`). Vercel Environment Variables korrekt konfigurieren. API Route ist Server-only.
