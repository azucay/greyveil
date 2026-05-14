# ERI-1 — Doppelte Baufortschrittsanzeige bei Gebäuden entfernen

Status: ✅ Done
Datum: 2026-05-14

## Ziel

Bei Gebäuden ist pro Baufortschritt nur noch eine Anzeige sichtbar.

## Ursache

`Building.drawProgressBar()` zeichnete zwei visuelle Fortschrittsindikatoren mit demselben `buildProgress`:

- den eigentlichen grünen Fortschrittsbalken direkt über dem Gebäude
- zusätzlich eine kleinere Pill-/Mini-Balken-Anzeige darüber

## Umsetzung

- Die redundante Mini-Fortschrittsanzeige wurde aus `game/entities/buildings/Building.ts` entfernt.
- Der vorhandene Hauptbalken bleibt über dem Gebäude erhalten.
- Die Logik für fertige Gebäude bleibt unverändert: beim Abschluss wird `progressGfx.clear()` ausgeführt.

## Akzeptanzkriterien

- [x] Pro Gebäude ist nur noch eine Baufortschrittsanzeige sichtbar.
- [x] Die verbleibende Anzeige sitzt sinnvoll über dem Gebäude und ist gut lesbar.
- [x] Kein doppelter Prozent-/Progress-Text oder doppelter Balken für denselben Baufortschritt.
- [x] Bestehende Anzeige-Logik für fertige Gebäude bleibt unverändert.
- [x] `npm run build` läuft erfolgreich.

## Verifikation

- `npm run build` ✅
- Reviewer: APPROVED ✅
