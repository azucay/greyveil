# T021: KI-Verbesserung — Mehrphasige Strategie

Status: 🔲 Open
GitHub: https://github.com/azucay/greyveil/issues/19

## Problem

Die Script-KI in `game/systems/AISystem.ts` baut aktuell nur rudimentär und bleibt im Spielverlauf hängen. Zusätzlich gibt es konkrete Bugs beim Bauablauf:

- Farm und Mine werden teilweise begonnen, aber nicht fertiggestellt
- Bau-/Worker-Zustand kann hängen bleiben, sodass geplante Wirtschaftsgebäude nie produktiv werden
- Dadurch entsteht kein stabiler Nahrungs-/Metallfluss
- Schwertmann-Training stockt, weil Nahrung/Metall fehlen
- Kein zweiter Angriffswelle nach dem ersten Angriff
- Worker werden nicht neu trainiert, wenn sie sterben

## Ziel

Die regelbasierte Script-KI soll eine einfache, robuste Mehrphasen-Strategie bekommen und begonnene Gebäude zuverlässig fertigstellen.

## Anforderungen

### Bugfix Bauablauf

- Reproduzieren, warum Farm/Mine teilweise nicht fertig gebaut werden
- Sicherstellen, dass KI-Worker begonnene Gebäude fertigstellen oder sauber neu zugewiesen werden
- Keine halbgebauten Wirtschaftsgebäude, die dauerhaft blockieren

### Wirtschaftsphase

- Baut Farm sobald 60 Holz verfügbar ist
- Baut Mine sobald 80 Holz + 60 Stein verfügbar sind
- Baut 2. Kaserne nach erstem Angriff oder sobald Economy stabil ist

### Militärphase

- Trainiert Mix aus Schwertmännern und Bogenschützen je nach Ressourcen
- Greift mit 5+ Soldaten an, danach weiter trainieren
- Kontinuierliche Angriffswellen statt einmalig

### Resilienz

- Zählt lebende Worker, trainiert neue wenn unter 2
- Wenn KI-Rathaus angegriffen wird → Soldaten zurückbeordern

## Akzeptanzkriterien

- [ ] Farm und Mine der KI werden nach Start zuverlässig fertiggestellt, sofern Ressourcen verfügbar sind
- [ ] KI bleibt nach erstem Angriff aktiv und startet weitere Wellen
- [ ] KI kann verlorene Worker ersetzen
- [ ] Kein dauerhaft hängender KI-Bauauftrag
- [ ] `npm run build` läuft erfolgreich

## Betroffene Dateien

- `game/systems/AISystem.ts`
- ggf. Worker-/Building-Systeme, falls der Bau-Bug dort verursacht wird
