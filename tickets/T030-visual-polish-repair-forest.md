# T030 — Visual Polish, Waldabbau, Reparaturen und Spielgefühl

Status: ✅ Done
Phase: Polish/MVP

## Ziel
Greyveil soll visuell hochwertiger wirken, Holz als Wald darstellen, plausiblere Kosten nutzen und beschädigte Gebäude reparierbar machen.

## Umgesetzt
- Gebäude-Rendering mit differenzierten Silhouetten/Details für Rathaus, Kaserne, Farm, Mine und Wachturm.
- Arbeiter-Grafik verbessert: Schatten, Helm/Highlight und Werkzeug statt einfachem Kreis.
- Holz-Ressourcen werden als kleine Waldgruppe gerendert und dünnen beim Abbauen sichtbar aus.
- Arbeiter kosten jetzt Nahrung statt Holz; Einheiten- und Gebäudekosten wurden plausibler balanciert.
- Reparatur-Flow: beschädigte eigene Gebäude können per Arbeiter-Tap oder Reparatur-Button repariert werden.
- UI zeigt Gebäude-HP und Reparatur-Button bei beschädigten Gebäuden.
- Spielgefühl verbessert durch leicht toleranteren Tap/Drag-Threshold und sanftere Kamera-Bewegung.

## Akzeptanz
- `npm run build` läuft erfolgreich.
- Waldabbau aktualisiert die Visuals während des Sammelns.
- Reparatur stoppt automatisch bei vollen HP.

## Erweiterung — große Wälder & Feedback
- Holz erscheint jetzt in mehreren großen, zusammenhängenden Wald-Clustern statt als einzelne kleine Nodes.
- Jeder Wald umfasst bis zu ca. 20 Felder; Wald-Felder blockieren Bewegung, bis sie abgeholzt wurden.
- Sobald ein Baumfeld leer ist, wird es wieder begehbar — Spieler können sich sichtbar durch Waldgebiete durcharbeiten.
- Bauplatzierung blockiert jetzt Ressourcenfelder zuverlässig.
- Kleine synthetische Sound-Cues für Bauen, Sammelbefehle und Reparatur ergänzt.
- Befehls-Pulse auf der Karte und Reparatur-Funken machen Aktionen lesbarer.
- Startressourcen leicht erhöht, damit das neue Balancing flüssiger startet.
