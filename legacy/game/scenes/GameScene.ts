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
  private selectionEmitTimer = 0

  constructor() { super({ key: 'GameScene' }) }

  create(): void {
    this.mapSystem = new MapSystem()
    this.mapSystem.render(this)

    this.resourceSystem = new ResourceSystem()
    this.resourceSystem.placeNodes(this, this.mapSystem.getMap())

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

    EventBus.on<BuildingType>('start-build', (type) => {
      this.buildMode = type
      EventBus.emit<BuildingType | null>('build-mode-changed', type)
    })
    EventBus.on<void>('cancel-build', () => {
      this.buildMode = null
      EventBus.emit<BuildingType | null>('build-mode-changed', null)
    })
    EventBus.on<void>('request-train-worker', () => {
      if (this.selectedBuilding?.buildingType === 'townhall') {
        this.unitSystem.startTraining(this.selectedBuilding)
      }
    })
    EventBus.on<SoldierType>('request-train-soldier', (type) => {
      if (this.selectedBuilding?.buildingType === 'barracks' && this.selectedBuilding.built) {
        this.unitSystem.startTrainingSoldier(this.selectedBuilding, type)
      }
    })
    // T11: select all player soldiers
    EventBus.on<void>('select-all-soldiers', () => {
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

      // T11: prune dead soldiers from selection
      this.selectedSoldiers = this.selectedSoldiers.filter(s => s.state !== 'dead')

      if (this.selectedWorker) {
        EventBus.emit<GameSelection>('selection-changed', { type: 'worker', workerState: this.selectedWorker.workerState })
      } else if (this.selectedBuilding?.buildingType === 'barracks') {
        const training = this.unitSystem.getSoldierTraining(this.selectedBuilding)
        EventBus.emit<GameSelection>('selection-changed', { type: 'barracks', built: this.selectedBuilding.built, training })
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

  private handleTap(worldX: number, worldY: number): void {
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    if (this.buildMode !== null) {
      const tile = this.mapSystem.getTile(tileX, tileY)
      const walkable = tile?.walkable ?? false
      if (walkable && !this.buildingSystem.isTileOccupied(tileX, tileY) && tile?.type !== 'water' && tile?.type !== 'mountain') {
        const building = new Building(this, this.buildMode, 'player', tileX, tileY)
        this.buildingSystem.addBuilding(building, tileX, tileY)
        const buildCost = BUILDING_CONFIGS[this.buildMode].cost
        for (const [rType, amount] of Object.entries(buildCost)) {
          this.resourceSystem.subtract('player', rType as ResourceType, amount as number)
        }
        const builder = this.selectedWorker ?? this.unitSystem.workers.find(w => w.workerState === 'idle' && w.faction === 'player') ?? null
        if (builder) this.unitSystem.commandBuild(builder, building)
        this.buildMode = null
        EventBus.emit<BuildingType | null>('build-mode-changed', null)
        this.clearSelection()
        this.selectedBuilding = building
        building.setSelected(true)
        this.emitBuildingSelection(building)
      }
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
        this.clearSelection()
        this.selectedBuilding = building
        building.setSelected(true)
        this.emitBuildingSelection(building)
        return
      }
    }

    if (this.selectedWorker) {
      const node = this.resourceSystem.nodes.find(n => n.tileX === tileX && n.tileY === tileY && !n.depleted)
      if (node) this.unitSystem.commandGather(this.selectedWorker, node)
      else this.unitSystem.commandMove(this.selectedWorker, worldX, worldY)
      return
    }

    const playerSoldiers = this.selectedSoldiers.filter(s => s.faction === 'player')
    if (playerSoldiers.length > 0) {
      this.combatSystem.commandMoveSoldiers(playerSoldiers, worldX, worldY)
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

  private emitBuildingSelection(building: Building): void {
    const btype = building.buildingType
    if (btype === 'townhall') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'townhall', training: null })
    } else if (btype === 'barracks') {
      const training = this.unitSystem.getSoldierTraining(building)
      EventBus.emit<GameSelection>('selection-changed', { type: 'barracks', built: building.built, training })
    } else if (btype === 'farm') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'farm', built: building.built })
    } else if (btype === 'mine') {
      EventBus.emit<GameSelection>('selection-changed', { type: 'mine', built: building.built })
    }
  }

  private clearSelection(): void {
    if (this.selectedWorker) { this.selectedWorker.setSelected(false); this.selectedWorker = null }
    if (this.selectedBuilding) { this.selectedBuilding.setSelected(false); this.selectedBuilding = null }
    for (const s of this.selectedSoldiers) s.setSelected(false)
    this.selectedSoldiers = []
    EventBus.emit<GameSelection>('selection-changed', { type: 'none' })
  }

  private setupKeyboard(): void {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
  }

  private setupDragPanning(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartX = pointer.x; this.dragStartY = pointer.y
      this.pointerDownX = pointer.x; this.pointerDownY = pointer.y
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !pointer.isDown) return
      const cam = this.cameras.main
      cam.scrollX -= pointer.x - this.dragStartX
      cam.scrollY -= pointer.y - this.dragStartY
      this.dragStartX = pointer.x; this.dragStartY = pointer.y
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.pointerDownX
      const dy = pointer.y - this.pointerDownY
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
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
    if (this.cursors.left.isDown || this.wasd.left.isDown) cam.scrollX -= speed
    else if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += speed
    if (this.cursors.up.isDown || this.wasd.up.isDown) cam.scrollY -= speed
    else if (this.cursors.down.isDown || this.wasd.down.isDown) cam.scrollY += speed
  }
}
