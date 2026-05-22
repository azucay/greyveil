import * as Phaser from 'phaser'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA_SPEED, PLAYER_START_TILE } from '@/game/constants'
import { EventBus } from '@/game/EventBus'
import { MapSystem } from '@/game/systems/MapSystem'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { UnitSystem } from '@/game/systems/UnitSystem'
import { CombatSystem } from '@/game/systems/CombatSystem'
import { AISystem } from '@/game/systems/AISystem'
import { Building } from '@/game/entities/buildings/Building'
import { Soldier } from '@/game/entities/units/Soldier'
import { BUILDING_CONFIGS } from '@/types/buildings'
import type { BuildingType } from '@/types/buildings'
import type { ResourceType } from '@/types/resources'
import type { GameSelection, SoldierType } from '@/types/units'
import type { MinimapData } from '@/types/minimap'
import type { Worker } from '@/game/entities/units/Worker'

type BuildPreview = {
  type: BuildingType
  tileX: number
  tileY: number
  valid: boolean
  pinned: boolean
  gfx: Phaser.GameObjects.Graphics
  confirmText: Phaser.GameObjects.Text
  cancelText: Phaser.GameObjects.Text
}

export class GameScene extends Phaser.Scene {
  private mapSystem!: MapSystem
  resourceSystem!: ResourceSystem
  buildingSystem!: BuildingSystem
  unitSystem!: UnitSystem
  combatSystem!: CombatSystem
  private aiSystem!: AISystem

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key }

  private dragStartX = 0
  private dragStartY = 0
  private isDragging = false
  private pointerDownX = 0
  private pointerDownY = 0

  private selectedWorker: Worker | null = null
  private selectedBuilding: Building | null = null
  private selectedSoldiers: Soldier[] = []
  buildMode: BuildingType | null = null
  private buildPreview: BuildPreview | null = null
  private lastSoldierTap: { soldier: Soldier; time: number } | null = null
  private selectionEmitTimer = 0
  private audioContext: AudioContext | null = null
  private eventDisposers: (() => void)[] = []

  constructor() { super({ key: 'GameScene' }) }

  private onBus<T>(event: string, callback: (data: T) => void): void {
    EventBus.on<T>(event, callback)
    this.eventDisposers.push(() => EventBus.off<T>(event, callback))
  }

  private cleanupEventBus(): void {
    for (const dispose of this.eventDisposers) dispose()
    this.eventDisposers = []
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupEventBus())

    this.mapSystem = new MapSystem()
    this.mapSystem.render(this)

    this.resourceSystem = new ResourceSystem()
    this.resourceSystem.placeNodes(this, this.mapSystem.getMap(), this.mapSystem)

    this.buildingSystem = new BuildingSystem(this, this.resourceSystem)
    this.combatSystem = new CombatSystem(this.mapSystem)

    const th = new Building(this, 'townhall', 'player', PLAYER_START_TILE.x, PLAYER_START_TILE.y)
    this.buildingSystem.addBuilding(th, PLAYER_START_TILE.x, PLAYER_START_TILE.y)

    this.unitSystem = new UnitSystem(this, this.resourceSystem, this.buildingSystem, this.mapSystem, this.combatSystem)

    const thX = PLAYER_START_TILE.x * TILE_SIZE + TILE_SIZE / 2
    const thY = PLAYER_START_TILE.y * TILE_SIZE + TILE_SIZE / 2
    for (const { dx, dy } of [{ dx: 60, dy: 0 }, { dx: 60, dy: 20 }, { dx: 60, dy: -20 }]) {
      this.unitSystem.spawnWorker(thX + dx, thY + dy, thX, thY, 'player')
    }

    this.aiSystem = new AISystem(this, this.resourceSystem, this.buildingSystem, this.unitSystem, this.combatSystem, this.mapSystem)
    this.aiSystem.init()

    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
    this.setupKeyboard()
    this.setupDragPanning()

    this.onBus<BuildingType>('start-build', (type) => {
      this.setBuildMode(type)
    })
    this.onBus<void>('cancel-build', () => {
      this.cancelBuildMode()
    })
    this.onBus<void>('confirm-build', () => {
      this.confirmBuildPreview()
    })
    this.onBus<void>('request-train-worker', () => {
      if (this.selectedBuilding?.buildingType === 'townhall') {
        this.unitSystem.startTraining(this.selectedBuilding)
      }
    })
    this.onBus<SoldierType>('request-train-soldier', (type) => {
      if (this.selectedBuilding?.buildingType === 'barracks' && this.selectedBuilding.built) {
        this.unitSystem.startTrainingSoldier(this.selectedBuilding, type)
      }
    })
    this.onBus<void>('request-repair-building', () => {
      if (!this.selectedBuilding || !this.buildingSystem.hasBuilding(this.selectedBuilding) || this.selectedBuilding.faction !== 'player' || !this.selectedBuilding.damaged) return
      const repairer = this.selectedWorker ?? this.unitSystem.workers.find(w => w.workerState === 'idle' && w.faction === 'player') ?? null
      if (repairer) {
        this.unitSystem.commandRepair(repairer, this.selectedBuilding)
        this.playTone(520, 0.06, 'sine')
        this.showCommandPulse(this.selectedBuilding.x, this.selectedBuilding.y, 0x22c55e)
      }
    })
    // T11: select all player soldiers
    this.onBus<void>('select-all-soldiers', () => {
      this.clearSelection()
      this.selectedSoldiers = this.combatSystem.getSoldiersOfFaction('player')
      for (const s of this.selectedSoldiers) s.setSelected(true)
      this.emitSoldierSelection()
    })

    this.scene.launch('UIScene')
  }

  update(_time: number, delta: number): void {
    this.handleKeyboardCamera(delta)
    this.unitSystem.update(delta)
    this.buildingSystem.update(delta)
    this.combatSystem.update(delta, this.buildingSystem)
    this.aiSystem.update(delta)

    this.selectionEmitTimer += delta
    if (this.selectionEmitTimer >= 500) {
      this.selectionEmitTimer = 0

      // T11: prune dead soldiers and stale destroyed buildings from selection
      this.selectedSoldiers = this.selectedSoldiers.filter(s => s.state !== 'dead')
      if (this.selectedBuilding && !this.buildingSystem.hasBuilding(this.selectedBuilding)) {
        this.selectedBuilding.setSelected(false)
        this.selectedBuilding = null
      }

      if (this.selectedWorker) {
        EventBus.emit<GameSelection>('selection-changed', { type: 'worker', workerState: this.selectedWorker.workerState })
      } else if (this.selectedBuilding) {
        this.emitBuildingSelection(this.selectedBuilding)
      } else if (this.selectedSoldiers.length > 0) {
        this.emitSoldierSelection()
      }

      // T14: minimap update
      const cam = this.cameras.main
      EventBus.emit<MinimapData>('minimap-update', {
        buildings: [...this.buildingSystem.buildings.values()].map(b => ({ wx: b.x, wy: b.y, faction: b.faction })),
        soldiers: this.combatSystem.soldiers.filter(s => s.state !== 'dead').map(s => ({ wx: s.x, wy: s.y, faction: s.faction })),
        cameraX: cam.scrollX, cameraY: cam.scrollY,
        cameraW: cam.width, cameraH: cam.height,
        mapW: MAP_WIDTH * TILE_SIZE, mapH: MAP_HEIGHT * TILE_SIZE,
      })

      // T16: pop-cap update
      EventBus.emit<{ count: number; cap: number }>('pop-update', {
        count: this.unitSystem.popCount, cap: this.unitSystem.popCap,
      })
    }
  }

  private setBuildMode(type: BuildingType): void {
    this.destroyBuildPreview()
    this.buildMode = type
    EventBus.emit<BuildingType | null>('build-mode-changed', type)
    EventBus.emit<{ type: BuildingType; ready: boolean; valid: boolean } | null>('build-preview-changed', null)

    const pointer = this.input.activePointer
    if (pointer) {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      this.showBuildPreview(type, Math.floor(wp.x / TILE_SIZE), Math.floor(wp.y / TILE_SIZE))
    }
  }

  private cancelBuildMode(): void {
    this.buildMode = null
    this.destroyBuildPreview()
    EventBus.emit<BuildingType | null>('build-mode-changed', null)
    EventBus.emit<{ type: BuildingType; ready: boolean; valid: boolean } | null>('build-preview-changed', null)
  }

  private destroyBuildPreview(): void {
    if (!this.buildPreview) return
    this.buildPreview.gfx.destroy()
    this.buildPreview.confirmText.destroy()
    this.buildPreview.cancelText.destroy()
    this.buildPreview = null
  }

  private isValidBuildTile(tileX: number, tileY: number): boolean {
    const tile = this.mapSystem.getTile(tileX, tileY)
    const walkable = tile?.walkable ?? false
    const hasResource = this.resourceSystem.nodes.some(node => !node.depleted && node.tileX === tileX && node.tileY === tileY)
    return walkable && !hasResource && !this.buildingSystem.isTileOccupied(tileX, tileY) && tile?.type !== 'water' && tile?.type !== 'mountain'
  }

  private canAffordBuild(type: BuildingType): boolean {
    return this.resourceSystem.canAfford('player', BUILDING_CONFIGS[type].cost)
  }

  private showBuildPreview(type: BuildingType, tileX: number, tileY: number, pinned = false): void {
    const tileValid = this.isValidBuildTile(tileX, tileY)
    const affordable = this.canAffordBuild(type)
    const valid = tileValid && affordable
    const config = BUILDING_CONFIGS[type]
    const worldX = tileX * TILE_SIZE + TILE_SIZE / 2
    const worldY = tileY * TILE_SIZE + TILE_SIZE / 2
    const hw = config.width / 2
    const hh = config.height / 2
    const color = valid ? config.color : 0xef4444

    if (!this.buildPreview) {
      const confirmText = this.add.text(0, 0, '✓', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#bbf7d0',
        backgroundColor: 'rgba(22,101,52,0.92)',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(7).setInteractive({ useHandCursor: true })
      const cancelText = this.add.text(0, 0, '✕', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#fecaca',
        backgroundColor: 'rgba(127,29,29,0.92)',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(7).setInteractive({ useHandCursor: true })
      confirmText.on('pointerup', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation()
        this.confirmBuildPreview()
      })
      cancelText.on('pointerup', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation()
        this.cancelBuildMode()
      })
      this.buildPreview = { type, tileX, tileY, valid, pinned, gfx: this.add.graphics(), confirmText, cancelText }
      this.buildPreview.gfx.setDepth(4)
    }

    this.buildPreview.type = type
    this.buildPreview.tileX = tileX
    this.buildPreview.tileY = tileY
    this.buildPreview.valid = valid
    this.buildPreview.pinned = pinned
    this.buildPreview.gfx.clear()
    this.buildPreview.gfx.setPosition(worldX, worldY)
    this.buildPreview.gfx.fillStyle(color, valid ? 0.38 : 0.22)
    this.buildPreview.gfx.fillRoundedRect(-hw, -hh, config.width, config.height, 4)
    this.buildPreview.gfx.lineStyle(2, valid ? 0x22c55e : 0xef4444, 0.95)
    this.buildPreview.gfx.strokeRoundedRect(-hw, -hh, config.width, config.height, 4)
    this.buildPreview.gfx.lineStyle(1, 0xffffff, 0.35)
    this.buildPreview.gfx.strokeRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE)

    const actionY = worldY + hh + 22
    this.buildPreview.confirmText.setPosition(worldX - 18, actionY)
    this.buildPreview.cancelText.setPosition(worldX + 18, actionY)
    this.buildPreview.confirmText.setVisible(pinned)
    this.buildPreview.cancelText.setVisible(pinned)
    this.buildPreview.confirmText.setAlpha(valid ? 1 : 0.38)
    this.buildPreview.confirmText.disableInteractive()
    this.buildPreview.cancelText.disableInteractive()
    if (pinned && valid) this.buildPreview.confirmText.setInteractive({ useHandCursor: true })
    if (pinned) this.buildPreview.cancelText.setInteractive({ useHandCursor: true })

    EventBus.emit<{ type: BuildingType; ready: boolean; valid: boolean } | null>('build-preview-changed', { type, ready: pinned, valid })
  }

  private confirmBuildPreview(): void {
    if (!this.buildMode || !this.buildPreview || !this.buildPreview.pinned || !this.buildPreview.valid) return

    const { type, tileX, tileY } = this.buildPreview
    if (!this.isValidBuildTile(tileX, tileY) || !this.canAffordBuild(type)) {
      this.showBuildPreview(type, tileX, tileY)
      return
    }

    const building = new Building(this, type, 'player', tileX, tileY)
    this.buildingSystem.addBuilding(building, tileX, tileY)
    const buildCost = BUILDING_CONFIGS[type].cost
    for (const [rType, amount] of Object.entries(buildCost)) {
      this.resourceSystem.subtract('player', rType as ResourceType, amount as number)
    }
    EventBus.emit('resources-updated', this.resourceSystem.getPlayerResources())

    const builder = this.selectedWorker ?? this.unitSystem.workers.find(w => w.workerState === 'idle' && w.faction === 'player') ?? null
    if (builder) this.unitSystem.commandBuild(builder, building)
    this.playTone(220, 0.08, 'triangle')
    this.showCommandPulse(building.x, building.y, 0x22c55e)

    this.cancelBuildMode()
    this.clearSelection()
    this.selectedBuilding = building
    building.setSelected(true)
    this.emitBuildingSelection(building)
  }

  private handleTap(worldX: number, worldY: number): void {
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    if (this.buildMode !== null) {
      this.showBuildPreview(this.buildMode, tileX, tileY, true)
      return
    }

    const tapSoldier = this.combatSystem.getSoldierAt(worldX, worldY)
    if (tapSoldier) {
      const playerSoldiers = this.selectedSoldiers.filter(s => s.faction === 'player')
      if (tapSoldier.faction === 'ai' && playerSoldiers.length > 0) {
        this.combatSystem.commandAttack(playerSoldiers, tapSoldier)
        return
      }
      if (tapSoldier.faction === 'player') {
        const now = this.time.now
        const isDoubleTap = this.lastSoldierTap?.soldier === tapSoldier && now - this.lastSoldierTap.time < 360
        this.lastSoldierTap = { soldier: tapSoldier, time: now }
        if (isDoubleTap) {
          this.selectVisiblePlayerSoldiers()
          return
        }
        this.clearSelection()
        this.selectedSoldiers = [tapSoldier]
        tapSoldier.setSelected(true)
        this.emitSoldierSelection()
        return
      }
    }

    const worker = this.unitSystem.getWorkerAt(worldX, worldY)
    if (worker && worker.faction === 'player') {
      this.clearSelection()
      this.selectedWorker = worker
      worker.setSelected(true)
      EventBus.emit<GameSelection>('selection-changed', { type: 'worker', workerState: worker.workerState })
      return
    }

    const building = this.buildingSystem.getBuildingAt(tileX, tileY)
    if (building) {
      const playerSoldiers = this.selectedSoldiers.filter(s => s.faction === 'player')
      if (building.faction === 'ai' && playerSoldiers.length > 0) {
        this.combatSystem.commandAttack(playerSoldiers, building)
        return
      }
      if (building.faction === 'player') {
        if (this.selectedWorker && !building.built) {
          this.unitSystem.commandBuild(this.selectedWorker, building)
          return
        }
        if (this.selectedWorker && building.built && building.damaged) {
          this.unitSystem.commandRepair(this.selectedWorker, building)
          return
        }
        this.clearSelection()
        this.selectedBuilding = building
        building.setSelected(true)
        this.emitBuildingSelection(building)
        return
      }
    }

    if (this.selectedWorker) {
      const node = this.resourceSystem.nodes.find(n => n.tileX === tileX && n.tileY === tileY && !n.depleted)
      if (node) {
        this.unitSystem.commandGather(this.selectedWorker, node)
        this.playTone(330, 0.04, 'square')
        this.showCommandPulse(node.tileX * TILE_SIZE + TILE_SIZE / 2, node.tileY * TILE_SIZE + TILE_SIZE / 2, node.type === 'wood' ? 0x22c55e : 0xfacc15)
      } else {
        this.unitSystem.commandMove(this.selectedWorker, worldX, worldY)
        this.showCommandPulse(worldX, worldY, 0x60a5fa)
      }
      return
    }

    const playerSoldiers = this.selectedSoldiers.filter(s => s.faction === 'player')
    if (playerSoldiers.length > 0) {
      this.combatSystem.commandMoveSoldiers(playerSoldiers, worldX, worldY)
      this.showCommandPulse(worldX, worldY, 0xa78bfa)
      return
    }

    this.clearSelection()
  }

  private emitSoldierSelection(): void {
    const alive = this.selectedSoldiers.filter(s => s.state !== 'dead')
    this.selectedSoldiers = alive
    if (alive.length === 0) {
      EventBus.emit<GameSelection>('selection-changed', { type: 'none' })
    } else if (alive.length === 1) {
      const s = alive[0]
      EventBus.emit<GameSelection>('selection-changed', { type: 'soldier', soldierType: s.soldierType, hp: s.hp, maxHp: s.maxHp })
    } else {
      const totalHp = alive.reduce((sum, s) => sum + s.hp, 0)
      const maxTotalHp = alive.reduce((sum, s) => sum + s.maxHp, 0)
      EventBus.emit<GameSelection>('selection-changed', { type: 'army', count: alive.length, totalHp, maxTotalHp })
    }
  }

  private selectVisiblePlayerSoldiers(): void {
    const view = this.cameras.main.worldView
    const visible = this.combatSystem.getSoldiersOfFaction('player')
      .filter(s => view.contains(s.x, s.y))
    if (visible.length === 0) return

    this.clearSelection()
    this.selectedSoldiers = visible
    for (const s of visible) s.setSelected(true)
    this.emitSoldierSelection()
    this.showCommandPulse(visible[0].x, visible[0].y, 0xa78bfa)
  }

  private emitBuildingSelection(building: Building): void {
    const btype = building.buildingType
    const stats = { built: building.built, hp: Math.ceil(building.hp), maxHp: building.maxHp, damaged: building.damaged }
    if (btype === 'townhall') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'townhall', training: this.unitSystem.getWorkerTraining(), queue: this.unitSystem.getWorkerTrainingQueue(), ...stats })
    } else if (btype === 'barracks') {
      const barracksTraining = this.unitSystem.getSoldierTraining(building)
      EventBus.emit<GameSelection>('selection-changed', { type: 'barracks', training: barracksTraining, queue: this.unitSystem.getSoldierTrainingQueue(building), ...stats })
    } else if (btype === 'farm') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'farm', ...stats })
    } else if (btype === 'mine') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'mine', ...stats })
    } else if (btype === 'watchtower') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'watchtower', ...stats })
    }
  }

  private clearSelection(): void {
    if (this.selectedWorker) { this.selectedWorker.setSelected(false); this.selectedWorker = null }
    if (this.selectedBuilding) { this.selectedBuilding.setSelected(false); this.selectedBuilding = null }
    for (const s of this.selectedSoldiers) s.setSelected(false)
    this.selectedSoldiers = []
    EventBus.emit<GameSelection>('selection-changed', { type: 'none' })
  }

  private showCommandPulse(worldX: number, worldY: number, color: number): void {
    const gfx = this.add.graphics()
    gfx.setDepth(6)
    gfx.lineStyle(2, color, 0.9)
    gfx.strokeCircle(0, 0, 6)
    gfx.setPosition(worldX, worldY)
    this.tweens.add({
      targets: gfx,
      alpha: 0,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => gfx.destroy(),
    })
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (typeof window === 'undefined') return
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
    const AudioCtor = window.AudioContext ?? audioWindow.webkitAudioContext
    if (!AudioCtor) return
    this.audioContext ??= new AudioCtor()
    const ctx = this.audioContext
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.025, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + duration)
  }

  private setupKeyboard(): void {
    const keyboard = this.input.keyboard!
    this.cursors = keyboard.createCursorKeys()
    this.wasd = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    const buildShortcuts: { key: number; type: BuildingType }[] = [
      { key: Phaser.Input.Keyboard.KeyCodes.F, type: 'farm' },
      { key: Phaser.Input.Keyboard.KeyCodes.K, type: 'barracks' },
      { key: Phaser.Input.Keyboard.KeyCodes.M, type: 'mine' },
      { key: Phaser.Input.Keyboard.KeyCodes.W, type: 'watchtower' },
    ]

    for (const { key, type } of buildShortcuts) {
      keyboard.addKey(key).on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
        if (event.repeat) return
        this.setBuildMode(type)
      })
    }
  }

  private setupDragPanning(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartX = pointer.x; this.dragStartY = pointer.y
      this.pointerDownX = pointer.x; this.pointerDownY = pointer.y
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildMode && !pointer.isDown && !this.buildPreview?.pinned) {
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
        this.showBuildPreview(this.buildMode, Math.floor(wp.x / TILE_SIZE), Math.floor(wp.y / TILE_SIZE), false)
        return
      }
      if (!this.isDragging || !pointer.isDown) return
      const cam = this.cameras.main
      cam.scrollX -= pointer.x - this.dragStartX
      cam.scrollY -= pointer.y - this.dragStartY
      this.dragStartX = pointer.x; this.dragStartY = pointer.y
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.pointerDownX
      const dy = pointer.y - this.pointerDownY
      if (Math.sqrt(dx * dx + dy * dy) < 18) {
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
        this.handleTap(wp.x, wp.y)
      }
      this.isDragging = false
    })
    this.input.on('pointerupoutside', () => { this.isDragging = false })
  }

  private handleKeyboardCamera(delta: number): void {
    const speed = (CAMERA_SPEED * delta) / 1000
    const cam = this.cameras.main
    const easedSpeed = speed * 0.92
    if (this.cursors.left.isDown || this.wasd.left.isDown) cam.scrollX -= easedSpeed
    else if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += easedSpeed
    if (this.cursors.up.isDown || this.wasd.up.isDown) cam.scrollY -= easedSpeed
    else if (this.cursors.down.isDown || this.wasd.down.isDown) cam.scrollY += easedSpeed
  }
}
