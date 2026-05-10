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
  private selectedSoldier: Soldier | null = null
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
      if (this.selectedWorker) {
        EventBus.emit<GameSelection>('selection-changed', { type: 'worker', workerState: this.selectedWorker.workerState })
      } else if (this.selectedBuilding?.buildingType === 'barracks') {
        const training = this.unitSystem.getSoldierTraining(this.selectedBuilding)
        EventBus.emit<GameSelection>('selection-changed', { type: 'barracks', built: this.selectedBuilding.built, training })
      } else if (this.selectedSoldier && this.selectedSoldier.state !== 'dead') {
        EventBus.emit<GameSelection>('selection-changed', {
          type: 'soldier', soldierType: this.selectedSoldier.soldierType,
          hp: this.selectedSoldier.hp, maxHp: this.selectedSoldier.maxHp,
        })
      }
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
      if (tapSoldier.faction === 'ai' && this.selectedSoldier?.faction === 'player') {
        this.combatSystem.commandAttack([this.selectedSoldier], tapSoldier)
        return
      }
      if (tapSoldier.faction === 'player') {
        this.clearSelection()
        this.selectedSoldier = tapSoldier
        tapSoldier.setSelected(true)
        EventBus.emit<GameSelection>('selection-changed', {
          type: 'soldier', soldierType: tapSoldier.soldierType, hp: tapSoldier.hp, maxHp: tapSoldier.maxHp,
        })
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
      if (building.faction === 'ai' && this.selectedSoldier?.faction === 'player') {
        this.combatSystem.commandAttack([this.selectedSoldier], building)
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

    if (this.selectedSoldier?.faction === 'player') {
      this.combatSystem.commandMoveSoldiers([this.selectedSoldier], worldX, worldY)
      return
    }

    this.clearSelection()
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
    if (this.selectedSoldier) { this.selectedSoldier.setSelected(false); this.selectedSoldier = null }
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
