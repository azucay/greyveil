# [T009] Sieg/Niederlage-Bedingung

## Ziel
Das Spiel hat einen klaren Sieg- und Niederlage-Zustand. Bei Sieg oder Niederlage wird ein Overlay angezeigt mit Spielzusammenfassung und Option zum Neustart.

## Kontext
Ohne Sieg/Niederlage-Bedingung ist das Spiel kein Spiel. Dieses Ticket schließt den vollständigen Gameplay-Loop ab und macht Greyveil zu einem spielbaren MVP.

**Abhängigkeiten:** T001–T008 müssen abgeschlossen sein.

## Akzeptanzkriterien
- [ ] Niederlage: Spieler-Rathaus wird zerstört → Spiel endet sofort
- [ ] Sieg: KI-Rathaus wird zerstört → Spiel endet sofort
- [ ] Fallback-Niederlage: Alle Spieler-Einheiten und Gebäude vernichtet → Niederlage
- [ ] Game-Over-Overlay: Fullscreen-Overlay über Phaser-Canvas
- [ ] Sieg-Overlay zeigt: "Greyveil gehört dir!" + Spielzeit + getötete Einheiten
- [ ] Niederlage-Overlay zeigt: "Urgok triumphiert!" + Spielzeit + verlorene Einheiten
- [ ] "Neues Spiel" Button startet Spiel komplett neu (Phaser Scene restart)
- [ ] Während Overlay: Spiel pausiert (Phaser `scene.pause()`)
- [ ] Spielzeit-Timer läuft von Spielstart und wird in Overlay angezeigt
- [ ] Statistiken: eigene Einheiten verloren, feindliche Einheiten getötet, Ressourcen gesammelt

## Definition of Ready
- [ ] AGENTS.md gelesen
- [ ] T001–T008 abgeschlossen

## Definition of Done
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Kein TypeScript-Fehler
- [ ] Manueller Test: KI-Rathaus manuell in Browser-Console auf 0 HP setzen → Sieg-Overlay; eigenes Rathaus zerstören → Niederlage-Overlay; Neustart funktioniert
- [ ] Learning-Eintrag in AGENTS.md geschrieben

## Technische Hinweise

**GameStateManager:**
Neues Singleton oder System das prüft:
```typescript
class GameStateManager {
  checkWinCondition(): 'playing' | 'player_wins' | 'ai_wins' {
    if (playerTownHall.hp <= 0 || allPlayerAssetsGone) return 'ai_wins'
    if (aiTownHall.hp <= 0) return 'player_wins'
    return 'playing'
  }
}
```

Prüfung erfolgt in `GameScene.update()` bei jedem Gebäude-Tod-Event.

**Phaser Events:**
```typescript
// Wenn Gebäude stirbt
this.events.emit('building-destroyed', { building, faction })

// GameStateManager hört zu
this.events.on('building-destroyed', ({ building, faction }) => {
  if (building instanceof TownHall) {
    this.triggerGameEnd(faction === 'ai' ? 'player_wins' : 'ai_wins')
  }
})
```

**Overlay als React-Komponente:**
Das Overlay ist eine React-Komponente (`/components/GameOverOverlay.tsx`) die über dem Phaser-Canvas liegt. Phaser-Event → React State-Update via EventEmitter.

**Spielzeit-Timer:**
`Date.now()` bei Spielstart speichern. Bei Spielende: `(Date.now() - startTime) / 1000` in Sekunden. Formatieren als MM:SS.

**Neues Spiel:**
```typescript
// React Button onClick
game.scene.stop('GameScene')
game.scene.stop('UIScene')
game.scene.start('BootScene')
// React State zurücksetzen
resetAllState()
```

**Statistiken sammeln:**
`StatsTracker` Klasse hört auf Events: `unit-died`, `resource-collected`, `building-destroyed`. Akkumuliert Zahlen und übergibt sie ans Overlay.
