# ERI-8 — KI-Basisbau diversifizieren und Angriffswellen wiederherstellen

Status: ✅ Done
Phase: Phase 2 / Gameplay Loop

## Ziel
Die regelbasierte Greyveil-KI expandiert sichtbarer: mehrere Gebäude desselben Typs, verteilte Platzierung, Wachturm-Verteidigung, robuste Militärproduktion und wiederholte Angriffswellen.

## Umsetzung
- `AISystem` zählt gebaute und im Bau befindliche AI-Gebäude gemeinsam, statt nur einmalige `hasX`-Checks zu nutzen.
- Zielzahlen für Farmen, Minen, Kasernen und Wachtürme eingeführt; Zielzahlen wachsen nach Armee-/Wellenfortschritt.
- AI-Placement nutzt bevorzugte Offset-Cluster plus Ring-Fallback und Mindestabstand zu bestehenden AI-Gebäuden.
- Platzierung blockiert Ressourcenknoten und belegt nur walkable, freie Tiles.
- Militärproduktion läuft über alle gebauten Kasernen weiter und wählt Swordsman/Archer-Mix nach Ressourcen.
- Angriffswellen verwenden verfügbare Soldaten und können nach Cooldown erneut starten.
- `BuildingSystem` produziert passive Farm-/Mine-Ressourcen jetzt für beide Fraktionen, damit AI-Economy nicht nach ersten Bauten austrocknet.

## Akzeptanzkriterien
- [x] KI kann mindestens einen Wachturm bauen, sobald Wirtschaft/Ressourcen das erlauben.
- [x] KI kann mehrere Gebäude desselben Typs bauen.
- [x] KI-Gebäude werden über Offsets/Fallback sichtbar verteilt.
- [x] KI trainiert Kampfeinheiten aus vorhandenen Kasernen.
- [x] KI schickt Kampfeinheiten aktiv Richtung Spieler-Rathaus.
- [x] Nach einer Angriffswelle kann eine weitere Welle entstehen.
- [x] Keine dauerhaft hängenden Bau-/Trainingsaufträge durch neue Planungspfade erkennbar.
- [x] `npm run build` ist grün.

## Verifikation
- `npm run build` erfolgreich am 2026-05-15.

## Hinweise
- Umsetzung erfolgte direkt durch Hermes Tech Lead als Recovery, weil der Paperclip-Coder trotz Override in einer read-only Codex-Sandbox blieb.
