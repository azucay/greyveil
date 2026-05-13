# T027: Baufortschritt direkt über Gebäude anzeigen

Status: ✅ Done
GitHub: https://github.com/azucay/greyveil/issues/27

## Problem
Der Fortschritt für Gebäude im Bau soll räumlich am Gebäude sichtbar sein.

## Ziel
Baufortschritt direkt über dem entstehenden Gebäude anzeigen.

## Anforderungen
- Fortschrittsanzeige erscheint über dem Gebäude im Bau.
- Anzeige ist klar lesbar, ohne das Spielfeld stark zu verdecken.
- Verschwindet sauber, sobald das Gebäude fertig ist.

## Akzeptanzkriterien
- Während des Baus ist der Fortschritt direkt am Gebäude sichtbar.
- Nach Abschluss bleibt keine Fortschrittsanzeige zurück.

## Umsetzung
- Baufortschritt wird als kompakter Balken direkt oberhalb des Gebäudes im Phaser-Canvas angezeigt.
- Die Anzeige verschwindet beim Fertigstellen automatisch.
