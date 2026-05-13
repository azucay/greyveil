# T024: Feindliche Gebäude-Schadenszustände sichtbar machen

Status: ✅ Done
GitHub: https://github.com/azucay/greyveil/issues/24

## Problem
Feindliche Gebäude wirken aktuell optisch nur ganz oder zerstört. Es ist nicht erkennbar, ob und wie stark sie beschädigt sind.

## Ziel
Gebäude-Schaden auch bei Gegnergebäuden während des Kampfes klar lesbar machen.

## Anforderungen
- Sichtbarer HP-/Schadensindikator für feindliche Gebäude.
- Beschädigung soll graduell erkennbar sein, nicht nur beim Tod.
- Lösung muss aus normaler Spielansicht ohne Auswahl verständlich sein.

## Akzeptanzkriterien
- Ein angegriffenes feindliches Gebäude zeigt seinen Schadenszustand sichtbar an.
- Voll beschädigte/nahe zerstörte Gebäude unterscheiden sich klar von intakten Gebäuden.

## Umsetzung
- HP-Balken und Riss-Overlays werden direkt am beschädigten Gebäude gezeichnet.
- Indikator erscheint auch bei feindlichen Gebäuden ohne Auswahl.
