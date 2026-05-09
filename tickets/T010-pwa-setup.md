# [T010] PWA Setup

## Ziel
Greyveil ist als Progressive Web App (PWA) installierbar und auf Mobile Browsern spielbar. Touch-Input funktioniert. Das Spiel lädt schnell und grundlegende Assets sind offline verfügbar.

## Kontext
PWA-Fähigkeit war im MVP Scope definiert. Mobile Browser sind ein wichtiger Vertriebskanal ohne App-Store-Abhängigkeit. Dieses Ticket ist der letzte Schritt vor dem MVP-Launch.

**Abhängigkeiten:** T001–T009 müssen abgeschlossen sein (vollständiges Spiel).

## Akzeptanzkriterien
- [ ] `manifest.json` mit korrekten Feldern: `name`, `short_name`, `display: "standalone"`, `theme_color`, `background_color`, `icons`
- [ ] Icons: mindestens 192×192 und 512×512 (als Phaser-generierte geometrische Formen exportiert oder SVG)
- [ ] Service Worker registriert und cached statische Assets (JS-Bundles, CSS)
- [ ] App ist "Add to Home Screen" installierbar (Chrome/Safari prüfen)
- [ ] Viewport Meta-Tag korrekt: `width=device-width, initial-scale=1`
- [ ] Touch-Input in Phaser: Tap = Klick, kein Zoom bei Doppel-Tap
- [ ] Phaser-Canvas skaliert auf Mobile-Viewport (responsive Größe)
- [ ] Landscape-Modus empfohlen / erzwungen via `screen.orientation.lock('landscape')` wo verfügbar
- [ ] Lighthouse PWA-Score ≥ 90
- [ ] Kein Layout-Overflow auf 375px Breite (iPhone SE)

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T009 abgeschlossen (vollständiges Spiel vorhanden)

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: Auf Chrome Mobile (Android) und Safari (iOS) getestet — Spiel spielbar, "Add to Home Screen" funktioniert
- [ ] Lighthouse PWA-Audit zeigt ≥ 90
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**Next.js PWA:**
`next-pwa` Package oder manueller Service Worker. Mit Next.js 15 App Router ist manueller SW über `/public/sw.js` einfacher als Package-Integration.

**manifest.json (`/public/manifest.json`):**
```json
{
  "name": "Greyveil",
  "short_name": "Greyveil",
  "description": "Fantasy RTS im Browser",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "theme_color": "#1a1a2e",
  "background_color": "#0d0d1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Icons:**
Da MVP keine externen Assets hat: Icons als einfache geometrische Formen (Schild-Symbol) via Canvas API oder SVG generieren. Kein externes Design-Tool nötig.

**Phaser Skalierung auf Mobile:**
```typescript
const config = {
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  }
}
```

**Touch-Input:**
Phaser unterstützt Touch nativ. Sicherstellen dass `pointer.rightButtonDown()` für Mobile korrekt gemappt ist (Long-Press = Rechtsklick oder separater Button im HUD).

**Service Worker Cache-Strategie:**
- Cache-First für statische Assets (JS, CSS)
- Network-First für `/api/ai` (Claude API muss online sein)
- Offline-Fallback: Spiel startet, Claude-API nicht verfügbar → KI fällt auf regelbasiertes System zurück (bereits in T008 implementiert)
