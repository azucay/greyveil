import * as Phaser from 'phaser'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA_SPEED, PLAYER_START_TILE } from '@/game/constants'
import { EventBus } from '@/game/EventBus'
import { MapSystem } from '@/game/systems/MapSystem'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { UnitSystem } from '@/game/systems/UnitSystem'
import { Building } from '@/game/entities/buildings/Building'
import type { BuildingType } from '@/types/buildings'
import type { GameSelection } from '@/types/units'
import type { Worker } from '@/game/entities/units/Worker'

export class GameScene extends Phaser.Scene {
  private mapSystem!: MapSystem
  resourceSystem!: ResourceSystem
  private buildingSystem!: BuildingSystem
  private unitSystem!: UnitSystem

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }

  private dragStartX = 0
  private dragStartY = 0
  private isDragging = false
  private pointerDownX = 0
  private pointerDownY = 0

  private selectedWorker: Worker | null = null
  private selectedBuilding: Building | null = null
  buildMode: BuildingType | null = null

  private selectionEmitTimer = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    // 1. Map
    this.mapSystem = new MapSystem()
    this.mapSystem.render(this)

    // 2. Resources
    this.resourceSystem = new ResourceSystem()
    this.resourceSystem.placeNodes(this, this.mapSystem.getMap())

    // 3. Buildings
    this.buildingSystem = new BuildingSystem(this, this.resourceSystem)

    // 4. Player town hall
    const th = new Building(this, 'townhall', 'player', PLAYER_START_TILE.x, PLAYER_START_TILE.y)
    this.buildingSystem.addBuilding(th, PLAYER_START_TILE.x, PLAYER_START_TILE.y)

    // 5. Unit system
    this.unitSystem = new UnitSystem(this, this.resourceSystem, this.buildingSystem)

    // 6. Spawn 3 workers near town hall
    const thWorldX = PLAYER_START_TILE.x * TILE_SIZE + TILE_SIZE / 2
    const thWorldY = PLAYER_START_TILE.y * TILE_SIZE + TILE_SIZE / 2
    const offsets = [
      { dx: 60, dy: 0 },
      { dx: 60, dy: 20 },
      { dx: 60, dy: -20 },
    ]
    for (const { dx, dy } of offsets) {
      this.unitSystem.spawnWorker(thWorldX + dx, thWorldY + dy, thWorldX, thWorldY)
    }

    // 7. Camera bounds
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)

    // 8. Keyboard
    this.setupKeyboard()

    // 9. Drag panning (with tap detection)
    this.setupDragPanning()

    // 10. EventBus subscriptions
    EventBus.on<BuildingType>('start-build', (type) => {
      this.buildMode = type
      EventBus.emit<BuildingType | null>('build-mode-changed', type)
    })

    EventBus.on<void>('cancel-build', () => {
      this.buildMode = null
      EventBus.emit<BuildingType | null>('build-mode-changed', null)
    })

    EventBus.on<void>('request-train-worker', () => {
      if (this.selectedBuilding && this.selectedBuilding.buildingType === 'townhall') {
        this.unitSystem.startTraining(this.selectedBuilding)
      }
    })

    // 11. Launch UIScene
    this.scene.launch('UIScene')
  }

  update(_time: number, delta: number): void {
    this.handleKeyboardCamera(delta)
    this.unitSystem.update(delta)
    this.buildingSystem.update(delta)

    // Emit selection-changed periodically for worker state updates
    this.selectionEmitTimer += delta
    if (this.selectionEmitTimer >= 1000) {
      this.selectionEmitTimer = 0
      if (this.selectedWorker) {
        EventBus.emit<GameSelection>('selection-changed', {
          type: 'worker',
          workerState: this.selectedWorker.workerState,
        })
      }
    }
  }

  private handleTap(worldX: number, worldY: number): void {
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    // Build mode: place a building
    if (this.buildMode !== null) {
      const tile = this.mapSystem.getTile(tileX, tileY)
      const walkable = tile?.walkable ?? false
      const occupied = this.buildingSystem.isTileOccupied(tileX, tileY)

      if (walkable && !occupied && tile?.type !== 'water' && tile?.type !== 'mountain') {
        const type = this.buildMode
        const building = new Building(this, type, 'player', tileX, tileY)
        this.buildingSystem.addBuilding(building, tileX, tileY)

        // Command a worker to build it
        const builder =
          this.selectedWorker ??
          this.unitSystem.workers.find((w) => w.workerState === 'idle') ??
          null

        if (builder) {
          this.unitSystem.commandBuild(builder, building)
        }

        this.buildMode = null
        EventBus.emit<BuildingType | null>('build-mode-changed', null)

        // Select the building
        if (this.selectedWorker) {
          this.selectedWorker.setSelected(false)
          this.selectedWorker = null
        }
        if (this.selectedBuilding) {
          this.selectedBuilding.setSelected(false)
        }
        this.selectedBuilding = building
        building.setSelected(true)
        this.emitBuildingSelection(building)
      }
      return
    }

    // Check worker at tap position
    const worker = this.unitSystem.getWorkerAt(worldX, worldY)
    if (worker) {
      // Deselect previous
      if (this.selectedWorker && this.selectedWorker !== worker) {
        this.selectedWorker.setSelected(false)
      }
      if (this.selectedBuilding) {
        this.selectedBuilding.setSelected(false)
        this.selectedBuilding = null
      }
      this.selectedWorker = worker
      worker.setSelected(true)
      EventBus.emit<GameSelection>('selection-changed', {
        type: 'worker',
        workerState: worker.workerState,
      })
      return
    }

    // Check building at tap position
    const building = this.buildingSystem.getBuildingAt(tileX, tileY)
    if (building) {
      if (this.selectedWorker) {
        this.selectedWorker.setSelected(false)
        this.selectedWorker = null
      }
      if (this.selectedBuilding && this.selectedBuilding !== building) {
        this.selectedBuilding.setSelected(false)
      }
      this.selectedBuilding = building
      building.setSelected(true)
      this.emitBuildingSelection(building)
      return
    }

    // If a worker is selected: gather or move
    if (this.selectedWorker) {
      const node = this.resourceSystem.nodes.find(
        (n) => n.tileX === tileX && n.tileY === tileY && !n.depleted
      )
      if (node) {
        this.unitSystem.commandGather(this.selectedWorker, node)
      } else {
        this.unitSystem.commandMove(this.selectedWorker, worldX, worldY)
      }
      return
    }

    // Deselect all
    this.clearSelection()
  }

  private emitBuildingSelection(building: Building): void {
    const btype = building.buildingType
    if (btype === 'townhall') {
      EventBus.emit<GameSelection>('selection-changed', {
        type: 'townhall',
        training: null,
      })
    } else if (btype === 'barracks') {
      EventBus.emit<GameSelection>('selection-changed', {
        type: 'barracks',
        built: building.built,
      })
    } else if (btype === 'farm') {
      EventBus.emit<GameSelection>('selection-changed', {
        type: 'farm',
        built: building.built,
      })
    } else if (btype === 'mine') {
      EventBus.emit<GameSelection>('selection-changed', {
        type: 'mine',
        built: building.built,
      })
    }
  }

  private clearSelection(): void {
    const w = this.selectedWorker
    if (w) {
      w.setSelected(false)
      this.selectedWorker = null
    }
    const b = this.selectedBuilding
    if (b) {
      b.setSelected(false)
      this.selectedBuilding = null
    }
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
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
      this.pointerDownX = pointer.x
      this.pointerDownY = pointer.y
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !pointer.isDown) return
      const cam = this.cameras.main
      cam.scrollX -= pointer.x - this.dragStartX
      cam.scrollY -= pointer.y - this.dragStartY
      this.dragStartX = pointer.x
      this.dragStartY = pointer.y
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.pointerDownX
      const dy = pointer.y - this.pointerDownY
      const moved = Math.sqrt(dx * dx + dy * dy)

      if (moved < 15) {
        // It's a tap — convert screen coords to world coords
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
        this.handleTap(worldPoint.x, worldPoint.y)
      }

      this.isDragging = false
    })

    this.input.on('pointerupoutside', () => {
      this.isDragging = false
    })
  }

  private handleKeyboardCamera(delta: number): void {
    const speed = (CAMERA_SPEED * delta) / 1000
    const cam = this.cameras.main

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      cam.scrollX -= speed
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      cam.scrollX += speed
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      cam.scrollY -= speed
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      cam.scrollY += speed
    }
  }
}
