# T031 — Warcraft-2-artige 2D-Asset-Pipeline

Status: 🔄 In Progress  
Phase: Visuals/Post-MVP

## Ziel

Greyveil soll weg von reiner Phaser-Graphics-API und hin zu einem klassischen 2D-RTS-Look: handgemalte/pixelige Top-Down-Sprites mit klaren Silhouetten, Teamfarben, Terrain-Tiles, Ressourcen und animierbaren Einheiten.

Referenzrichtung: Warcraft II / klassische 2D-RTS-Lesbarkeit — keine kopierten Blizzard-Assets.

## Entscheidung nach Referenzbild

Warcraft II bedeutet **nicht** 3D/Low-Poly wie Warcraft III, sondern:

- feste 2D-Sprites bzw. Sprite-Sheets,
- gemalte Terrain-Tiles,
- orthografische/leicht isometrische Gebäude,
- starke Konturen und lesbare Teamfarben,
- Animationen als kurze Sprite-Sequenzen,
- Atlas-/Sprite-Sheet-Pipeline statt zur Laufzeit gezeichneter Formen.

## Bereits umgesetzt

- `public/assets/greyveil/war2/` als erster echter Asset-Ordner angelegt.
- Erste originale Placeholder-Sprites erzeugt:
  - Terrain: Gras, Wasser, Berg
  - Ressourcen: Tanne/Waldbaum
  - Gebäude: Rathaus, Kaserne, Farm, Mine, Wachturm
  - Einheiten: Arbeiter, Soldat
- `game/assets/War2Assets.ts` als zentrale Asset-Registry angelegt.
- `BootScene` lädt die neuen PNG-Assets.
- `MapSystem` rendert Terrain jetzt aus echten Tile-PNGs, mit Graphics-Fallback.
- Gebäude verwenden echte PNG-Sprites, mit Graphics-Fallback.
- Arbeiter und Soldaten verwenden echte PNG-Sprites, mit Graphics-Fallback.
- Bogenschützen und Schwertkämpfer haben getrennte Top-Down-Placeholder-Sprites.
- Arbeiter zeigen beim Abholzen/Abbauen/Bauen/Reparieren eine einfache Tool-Swing-Animation.
- Waldkacheln verwenden echte Baum-Sprites und dünnen beim Abbau weiter sichtbar aus.

## Festgelegte Richtung

- Erstes Biom: Grünland, spätere Zusatzbiome optional.
- Erstes Volk: Menschen.
- Erste Asset-Priorität: Terrain vor Einheiten/Gebäuden/UI.
- Einheiten-Sprites müssen aus Top-Down-/RTS-Perspektive funktionieren; frontal gezeichnete Figuren dürfen nicht in Bewegungsrichtung gedreht werden.
- Der aktuelle Worker-Placeholder wurde deshalb durch einen nach Osten ausgerichteten Top-Down-/RTS-Sprite ersetzt.

## Asset-Pack-Kandidaten

- VEXED — Mini Medieval 8x8 Top-Down: ausdrücklich für RPG/RTS/TBS, echte Top-Down-Perspektive; CC-BY 4.0, daher Attribution einplanen. Sehr guter Kandidat für Menschen/Grünland-Prototypen.
- Aleksandr Makarov — RTS Micro Asset: explizites RTS-Micro-Pack mit kommerzieller Nutzung laut Seite; Lizenz verbietet Repack/Resell. Guter Kandidat für echte RTS-Units, aber Stil/Skalierung prüfen.
- AK TopDown Asset Packs — OpenGameArt: Sammlung freier CC0-Top-Down-Pixel/Tilesets; gut als lizenzsichere Suchrichtung für Terrain, Qualität/Stil pro Unterpack prüfen.
- CraftPix — Top Down Game Assets: kaufbare/freie Top-Down-Asset-Sammlung; Lizenz sauber, aber oft eher RPG/Action und nicht zwingend RTS. Einzelpacks prüfen.
- Kenney — Medieval RTS: CC0 und gut für Gebäude/Blockouts, aber keine passende vollständige Unit-Basis für unsere rotierenden Top-Down-Arbeiter.
- Pixel Frog — Tiny Swords: insgesamt stark, aber Einheiten sind zu frontal/charakterhaft für freie Rotation; nur bedingt für Greyveil-Units geeignet.

## Was noch nötig ist für wirklich schönen Warcraft-II-Look

1. **Finale Art Direction**
   - Fraktion/Farbwelt: Menschen/Grünland als v1.
   - Kamera/Tile-Skala finalisieren.

2. **Professionelle Sprite-Sheets**
   - Arbeiter: idle, walk, chop, carry, build, repair, death.
   - Soldaten: idle, walk, attack, hit, death.
   - Gebäude: normal, under construction, damaged, destroyed.

3. **Tile-Set statt Einzeltiles**
   - Terrain-Übergänge: Gras→Erde, Gras→Wald, Küste/Wasser, Bergkante.
   - Pfade/Footprints unter Gebäuden.
   - Deko: Steine, Büsche, Grasbüschel, Baumstümpfe.

4. **Sprite-Atlas-Workflow**
   - PNG-Sequenzen → Texture Atlas / Spritesheets.
   - Phaser-Animationen zentral registrieren.
   - Einheitliche Namenskonvention für Keys und Frames.

5. **Lizenzsichere Asset-Quelle**
   - Entweder eigene/AI-generierte Assets mit Nachbearbeitung.
   - Oder gekauftes/lizenzfreies RTS/Fantasy-2D-Asset-Pack.
   - Keine extrahierten Warcraft-/Blizzard-Dateien.

## Akzeptanzkriterien v1

- Build läuft mit echten Assets.
- Spiel bleibt vollständig spielbar, wenn einzelne Asset-Dateien fehlen.
- Zentrale Asset-Registry statt verstreuter String-Keys.
- Mindestens Terrain, Wald, Worker, Soldier und Kerngebäude sind PNG-basiert.
- Nächster Schritt kann echte Animationen/Atlases ohne Gameplay-Refactor ergänzen.
