import * as Phaser from 'phaser'
import { Building } from '@/game/entities/buildings/Building'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { UnitSystem } from '@/game/systems/UnitSystem'
import { CombatSystem } from '@/game/systems/CombatSystem'
import { MapSystem } from '@/game/systems/MapSystem'
import { AI_START_TILE, TILE_SIZE } from '@/game/constants'
import type { BuildingType } from '@/types/buildings'

type AIStrategy = 'gather' | 'build' | 'attack'

export class AISystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  private buildingSystem: BuildingSystem
  private unitSystem: UnitSystem
  private combatSystem: CombatSystem
  private mapSystem: MapSystem

  private decisionTimer: number = 0
  private claudeTimer: number = 0
  private strategy: AIStrategy = 'gather'

  private readonly DECISION_INTERVAL = 5000
  private readonly CLAUDE_INTERVAL = 30000

  constructor(
    scene: Phaser.Scene,
    resourceSystem: ResourceSystem,
    buildingSystem: BuildingSystem,
    unitSystem: UnitSystem,
    combatSystem: CombatSystem,
    mapSystem: MapSystem
  ) {
    this.scene = scene
    this.resourceSystem = resourceSystem
    this.buildingSystem = buildingSystem
    this.unitSystem = unitSystem
    this.combatSystem = combatSystem
    this.mapSystem = mapSystem
  }

  init(): void {
    const th = new Building(this.scene, 'townhall', 'ai', AI_START_TILE.x, AI_START_TILE.y)
    this.buildingSystem.addBuilding(th, AI_START_TILE.x, AI_START_TILE.y)

    const thX = AI_START_TILE.x * TILE_SIZE + TILE_SIZE / 2
    const thY = AI_START_TILE.y * TILE_SIZE + TILE_SIZE / 2
    for (const { dx, dy } of [{ dx: -60, dy: 0 }, { dx: -60, dy: 20 }, { dx: -60, dy: -20 }]) {
      this.unitSystem.spawnWorker(thX + dx, thY + dy, thX, thY, 'ai')
    }
  }

  update(delta: number): void {
    this.decisionTimer += delta
    if (this.decisionTimer >= this.DECISION_INTERVAL) {
      this.decisionTimer = 0
      this.makeDecision()
    }

    this.claudeTimer += delta
    if (this.claudeTimer >= this.CLAUDE_INTERVAL) {
      this.claudeTimer = 0
      void this.consultClaude()
    }
  }

  private makeDecision(): void {
    const aiWorkers = this.unitSystem.workers.filter(w => w.faction === 'ai')
    const aiBuildings = [...this.buildingSystem.buildings.values()].filter(b => b.faction === 'ai')
    const aiBarracks = aiBuildings.find(b => b.buildingType === 'barracks') ?? null
    const aiSoldiers = this.combatSystem.getSoldiersOfFaction('ai')

    // Always keep idle workers gathering
    for (const worker of aiWorkers) {
      if (worker.workerState === 'idle') {
        const node = this.resourceSystem.nodes.find(n => !n.depleted)
        if (node) this.unitSystem.commandGather(worker, node)
      }
    }

    // Strategy: gather until we have enough resources to do more
    if (this.strategy === 'gather') {
      if (this.resourceSystem.canAfford('ai', { wood: 100, stone: 80 })) {
        this.strategy = 'build'
      }
      return
    }

    // Strategy: build barracks if none
    if (this.strategy === 'build') {
      if (!aiBarracks) {
        this.buildAIBuilding('barracks')
        return
      }
      this.strategy = 'attack'
    }

    // Strategy: train soldiers and attack when ready
    if (this.strategy === 'attack') {
      if (aiBarracks?.built) {
        this.unitSystem.startTrainingSoldier(aiBarracks, 'swordsman', 'ai')
      }

      if (aiSoldiers.length >= 3) {
        const playerTH = this.buildingSystem.getTownHall('player')
        if (playerTH) {
          for (const soldier of aiSoldiers) {
            if (soldier.state === 'idle') {
              soldier.target = playerTH
              soldier.state = 'attacking'
            }
          }
        }
      }

      // If no barracks anymore (destroyed), rebuild
      if (!aiBarracks && this.resourceSystem.canAfford('ai', { wood: 100, stone: 80 })) {
        this.strategy = 'build'
      }
    }
  }

  private buildAIBuilding(type: BuildingType): void {
    const cost: Record<BuildingType, { wood?: number; stone?: number }> = {
      barracks: { wood: 100, stone: 80 },
      farm: { wood: 60 },
      mine: { wood: 80, stone: 60 },
      townhall: { wood: 0 },
    }
    const cx = AI_START_TILE.x
    const cy = AI_START_TILE.y

    for (let radius = 2; radius <= 8; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          const tx = cx + dx
          const ty = cy + dy
          if (!this.mapSystem.isWalkable(tx, ty)) continue
          if (this.buildingSystem.isTileOccupied(tx, ty)) continue

          const building = new Building(this.scene, type, 'ai', tx, ty)
          this.buildingSystem.addBuilding(building, tx, ty)

          const c = cost[type]
          if (c.wood) this.resourceSystem.subtract('ai', 'wood', c.wood)
          if (c.stone) this.resourceSystem.subtract('ai', 'stone', c.stone)

          const idle = this.unitSystem.workers.find(w => w.faction === 'ai' && w.workerState === 'idle')
            ?? this.unitSystem.workers.find(w => w.faction === 'ai')
          if (idle) this.unitSystem.commandBuild(idle, building)
          return
        }
      }
    }
  }

  private async consultClaude(): Promise<void> {
    try {
      const payload = {
        aiSoldiers: this.combatSystem.getSoldiersOfFaction('ai').length,
        playerSoldiers: this.combatSystem.getSoldiersOfFaction('player').length,
        aiWorkers: this.unitSystem.workers.filter(w => w.faction === 'ai').length,
        aiHasBarracks: [...this.buildingSystem.buildings.values()].some(b => b.faction === 'ai' && b.buildingType === 'barracks' && b.built),
        currentStrategy: this.strategy,
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json() as { strategy?: string }
        if (data.strategy === 'gather' || data.strategy === 'build' || data.strategy === 'attack') {
          this.strategy = data.strategy
        }
      }
    } catch {
      // silently ignore network errors
    }
  }
}
