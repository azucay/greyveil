# T028: Gebäudeplatzierung mit Preview und HUD-Bestätigung

Status: ✅ Done
GitHub: https://github.com/azucay/greyveil/issues/28

## Problem
Beim Bau startet die Platzierung zu direkt; man kann sich schnell verbauen.

## Ziel
Gebäude erst als transparente Vorschau platzieren und den Bau danach explizit bestätigen.

## Ablauf
1. Gebäude im HUD auswählen.
2. Erster Klick/Tap auf die Karte zeigt eine transparente Gebäude-Vorschau an der Zielposition.
3. Der Bau startet noch nicht.
4. Im HUD erscheint ein Häkchen-Icon zur Bestätigung.
5. Erst nach Bestätigung beginnt der Bau.

## Anforderungen
- Preview zeigt klar, wo das Gebäude stehen würde.
- HUD-Bestätigung per Häkchen startet den Bau.
- Optional/ideal: Abbrechen/Neuplatzieren möglich, bevor bestätigt wird.

## Akzeptanzkriterien
- Erster Kartenklick erzeugt nur die transparente Vorschau.
- Bau beginnt erst nach Häkchen-Bestätigung im HUD.
- Spieler kann nicht versehentlich sofort bauen.

## Umsetzung
- Gebäude-Auswahl startet nur den Platzierungsmodus.
- Erster Karten-Tap zeigt eine transparente Preview; erst das HUD-Häkchen bestätigt und startet den Bau.
- Abbrechen entfernt die Preview, ungültige Positionen blockieren die Bestätigung.
