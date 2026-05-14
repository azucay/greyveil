# T029 — Wachturm als defensives Gebäude hinzufügen

Status: ✅ Done  
Phase: Phase 2 / Gameplay Loop  
GitHub: https://github.com/azucay/greyveil/issues/29

## Ziel
Einen neuen Gebäudetyp **Wachturm** hinzufügen, der automatisch Pfeile auf nahende feindliche Einheiten schießt.

## Kontext
Greyveil hat bereits Gebäude, Einheitenkampf und visuelle Projektil-Effekte für Bogenschützen. Der Wachturm soll als defensives Gebäude den Basisbau taktischer machen, ohne direkt ein komplexes Verteidigungssystem einzuführen.

## Scope / Anforderungen
- Neuer Gebäudetyp `Wachturm` / `Watchtower` im bestehenden Gebäude-/Bausystem.
- Der Spieler kann den Wachturm bauen, sofern Ressourcen und Platzierung gültig sind.
- Wachturm hat eigene Kosten, Lebenspunkte und sichtbare Darstellung/Label.
- Wachturm sucht automatisch feindliche Einheiten in Reichweite.
- Bei gültigem Ziel feuert er in einem festen Intervall Pfeile/Projektile.
- Treffer verursachen Schaden am Ziel und nutzen möglichst bestehende Kampf-/Projektil-Logik wieder.
- Der Turm greift nicht außerhalb seiner Reichweite an und feuert nicht auf eigene Einheiten/Gebäude.

## Akzeptanzkriterien
- [x] Wachturm ist im Build-/HUD-System auswählbar und baubar.
- [x] Ressourcen werden beim Bau korrekt geprüft und abgezogen.
- [x] Der gebaute Wachturm erscheint visuell eindeutig auf der Karte.
- [x] Gegner in Reichweite werden automatisch beschossen.
- [x] Pfeil-/Projektil-Effekt ist sichtbar oder ein vorhandener Projektil-Effekt wird wiederverwendet.
- [x] Gegner erhalten Schaden; tote Gegner werden wie bisher entfernt/behandelt.
- [x] Keine Angriffe auf eigene Einheiten oder Ziele außerhalb der Reichweite.
- [x] `npm run build` ist grün.

## Umsetzung
- `watchtower` als Gebäudetyp mit eigenen Kosten, HP, Bauzeit, Reichweite, Schaden und Cooldown ergänzt.
- HUD-/Build-Menüs und Selektionsanzeige um Wachturm erweitert.
- Wachturm visuell als hoher Turm mit Dachspitze/Label gezeichnet.
- CombatSystem nutzt den bestehenden Pfeil-Effekt wieder und lässt gebaute Wachtürme nur feindliche Einheiten in Reichweite beschießen.

## Verifikation
- `npm run build` erfolgreich am 2026-05-14.

## Non-Goals
- Keine Upgrades/Tech-Tree.
- Keine manuelle Zielauswahl.
- Keine komplexe Turm-KI oder Prioritätslogik über „nächstes gültiges Ziel“ hinaus.
- Kein Balancing-Finetuning über sinnvolle MVP-Werte hinaus.

## Implementierungshinweise
- Bestehende Building-/Unit-/Combat-Systeme wiederverwenden statt Parallelstruktur bauen.
- Falls es bereits Archer-Projektile gibt, deren Visualisierung für Wachturm-Pfeile nutzen.
- Edge Cases: zerstörtes Ziel während Projektilflug, Ziel verlässt Reichweite, Tower noch im Bau, null/undefined target.
