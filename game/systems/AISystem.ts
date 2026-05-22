import * as Phaser from 'phaser'
import { Building } from '@/game/entities/buildings/Building'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { UnitSystem } from '@/game/systems/UnitSystem'
import { CombatSystem } from '@/game/systems/CombatSystem'
import { MapSystem } from '@/game/systems/MapSystem'
import { BUILDING_CONFIGS } from '@/types/buildings'
import { SOLDIER_CONFIGS } from '@/types/units'
import { AI_START_TILE, TILE_SIZE } from '@/game/constants'
import type { BuildingType } from '@/types/buildings'
import type { ResourceCost, ResourceType } from '@/types/resources'

const MIN_BUILDING_SPACING = 3

export class AISystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  private buildingSystem: BuildingSystem
  private unitSystem: UnitSystem
  private combatSystem: CombatSystem
  private mapSystem: MapSystem

  private decisionTimer = 0
  private claudeTimer   = 0
  private attackCooldown = 0
  private launchedWaves = 0

  private readonly DECISION_INTERVAL = 4000
  private readonly CLAUDE_INTERVAL   = 30000
  private readonly ATTACK_WAVE_COOLDOWN = 12000

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
    this.attackCooldown = Math.max(0, this.attackCooldown - delta)
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
    const aiWorkers   = this.unitSystem.workers.filter(w => w.faction === 'ai')
    const idleWorkers = aiWorkers.filter(w => w.workerState === 'idle')
    const livingWorkers = aiWorkers
    const aiBuildings = [...this.buildingSystem.buildings.values()].filter(b => b.faction === 'ai')
    const aiSoldiers  = this.combatSystem.getSoldiersOfFaction('ai')
    const res         = this.resourceSystem

    const farmCount = this.countAIBuildings(aiBuildings, 'farm')
    const mineCount = this.countAIBuildings(aiBuildings, 'mine')
    const barracks = aiBuildings.filter(b => b.buildingType === 'barracks')
    const barracksCount = barracks.length
    const builtBarracks = barracks.filter(b => b.built)
    const watchtowerCount = this.countAIBuildings(aiBuildings, 'watchtower')
    const unfinishedBuildings = aiBuildings.filter(b => !b.built)
    const playerTH = this.buildingSystem.getTownHall('player')
    const aiTH = this.buildingSystem.getTownHall('ai')

    // Keep unfinished AI buildings assigned before starting new work.
    for (const building of unfinishedBuildings) {
      const assignedWorker = aiWorkers.find(worker => worker.workerState === 'building' && worker.targetBuilding === building)
      if (assignedWorker) continue

      const builder = idleWorkers.shift()
        ?? aiWorkers.find(worker =>
          worker.workerState === 'idle' ||
          worker.workerState === 'gathering' ||
          worker.workerState === 'returning'
        )

      if (builder) {
        builder.workerState = 'idle'
        builder.targetNode = null
        builder.targetBuilding = null
        this.unitSystem.commandBuild(builder, building)
      }
    }

    // Resilience: replace dead workers and maintain a minimum labor force.
    if (livingWorkers.length < 3 && aiTH && !this.unitSystem.trainingTimer) {
      this.unitSystem.startTraining(aiTH, 'ai')
    }

    // Always keep idle workers gathering unless they are needed for building completion.
    for (const worker of idleWorkers) {
      const node = this.findBestGatherNode(worker)
      if (node) this.unitSystem.commandGather(worker, node)
    }

    if (unfinishedBuildings.length > 0) return

    const desiredFarms = aiSoldiers.length >= 6 || this.launchedWaves > 0 ? 3 : 2
    const desiredMines = aiSoldiers.length >= 4 || this.launchedWaves > 0 ? 2 : 1
    const desiredBarracks = aiSoldiers.length >= 3 || this.launchedWaves > 0 ? 2 : 1
    const desiredWatchtowers = farmCount >= 2 && mineCount >= 1 && barracksCount >= 1 ? 1 : 0

    if (farmCount < desiredFarms && this.canBuild('farm')) {
      this.buildAIBuilding('farm')
      return
    }

    if (mineCount < desiredMines && this.canBuild('mine')) {
      this.buildAIBuilding('mine')
      return
    }

    if (barracksCount < desiredBarracks && this.canBuild('barracks')) {
      this.buildAIBuilding('barracks')
      return
    }

    if (watchtowerCount < desiredWatchtowers && this.canBuild('watchtower')) {
      this.buildAIBuilding('watchtower')
      return
    }

    // Military: continuously train in all built barracks.
    for (const b of builtBarracks) {
      if (this.unitSystem.getSoldierTraining(b)) continue
      const nextType = aiSoldiers.length % 3 === 2 ? 'archer' : 'swordsman'
      const archerCost = SOLDIER_CONFIGS.archer.cost
      const swordsmanCost = SOLDIER_CONFIGS.swordsman.cost
      if (nextType === 'archer' && res.canAfford('ai', archerCost)) {
        this.unitSystem.startTrainingSoldier(b, 'archer', 'ai')
      } else if (res.canAfford('ai', swordsmanCost)) {
        this.unitSystem.startTrainingSoldier(b, 'swordsman', 'ai')
      } else if (res.canAfford('ai', archerCost)) {
        this.unitSystem.startTrainingSoldier(b, 'archer', 'ai')
      }
    }

    // Military: attack in repeatable waves, then keep producing the next wave.
    const playerCount = this.combatSystem.getSoldiersOfFaction('player').length
    const waveSize = this.launchedWaves === 0 ? 5 : 4
    const attackThreshold = playerCount >= 3 ? 3 : waveSize
    if (playerTH && aiSoldiers.length >= attackThreshold && this.attackCooldown <= 0) {
      const wave = aiSoldiers.filter(soldier => soldier.state === 'idle' || soldier.state === 'moving')
      if (wave.length >= Math.min(attackThreshold, 3)) {
        this.combatSystem.commandAttack(wave, playerTH)
        this.attackCooldown = this.ATTACK_WAVE_COOLDOWN
        this.launchedWaves++
      }
    }
  }

  private countAIBuildings(buildings: Building[], type: BuildingType): number {
    return buildings.filter(b => b.buildingType === type).length
  }

  private canBuild(type: BuildingType): boolean {
    return this.resourceSystem.canAfford('ai', BUILDING_CONFIGS[type].cost)
  }

  private buildAIBuilding(type: BuildingType): void {
    const cost = BUILDING_CONFIGS[type].cost
    const aiWorkers = this.unitSystem.workers.filter(w => w.faction === 'ai')
    const base = this.buildingSystem.getTownHall('ai')
    const cx = base ? base.tileX : AI_START_TILE.x
    const cy = base ? base.tileY : AI_START_TILE.y
    const location = this.findBuildingLocation(type, cx, cy)
    if (!location) return

    const building = new Building(this.scene, type, 'ai', location.tileX, location.tileY)
    this.buildingSystem.addBuilding(building, location.tileX, location.tileY)
    this.subtractCost(cost)

    const builder = aiWorkers.find(w => w.workerState === 'idle')
      ?? aiWorkers.find(w => w.workerState === 'gathering' || w.workerState === 'returning')
    if (builder) this.unitSystem.commandBuild(builder, building)
  }

  private findBuildingLocation(type: BuildingType, cx: number, cy: number): { tileX: number; tileY: number } | null {
    const preferredOffsets = this.getPreferredOffsets(type)
    for (const { dx, dy } of preferredOffsets) {
      const tx = cx + dx
      const ty = cy + dy
      if (this.isValidBuildTile(tx, ty, MIN_BUILDING_SPACING)) return { tileX: tx, tileY: ty }
    }

    for (let radius = 3; radius <= 14; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          const tx = cx + dx
          const ty = cy + dy
          if (this.isValidBuildTile(tx, ty, MIN_BUILDING_SPACING)) return { tileX: tx, tileY: ty }
        }
      }
    }

    for (let radius = 2; radius <= 16; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          const tx = cx + dx
          const ty = cy + dy
          if (this.isValidBuildTile(tx, ty, 1)) return { tileX: tx, tileY: ty }
        }
      }
    }

    return null
  }

  private getPreferredOffsets(type: BuildingType): { dx: number; dy: number }[] {
    const economy = [
      { dx: -4, dy: 2 }, { dx: -6, dy: 4 }, { dx: -3, dy: -4 }, { dx: -7, dy: -2 },
      { dx: 3, dy: 5 }, { dx: 5, dy: -4 }, { dx: 7, dy: 2 }, { dx: 2, dy: -7 },
    ]
    const military = [
      { dx: -5, dy: 0 }, { dx: -7, dy: 3 }, { dx: -4, dy: -5 }, { dx: 4, dy: 4 },
      { dx: 6, dy: -3 }, { dx: 8, dy: 1 }, { dx: 1, dy: -6 }, { dx: -8, dy: -4 },
    ]
    const defensive = [
      { dx: -3, dy: -3 }, { dx: 3, dy: -3 }, { dx: -3, dy: 3 }, { dx: 3, dy: 3 },
      { dx: 0, dy: -6 }, { dx: -6, dy: 0 }, { dx: 6, dy: 0 }, { dx: 0, dy: 6 },
    ]

    if (type === 'farm' || type === 'mine') return economy
    if (type === 'watchtower') return defensive
    return military
  }

  private isValidBuildTile(tileX: number, tileY: number, minSpacing: number): boolean {
    if (!this.mapSystem.isWalkable(tileX, tileY)) return false
    if (this.buildingSystem.isTileOccupied(tileX, tileY)) return false
    if (this.resourceSystem.nodes.some(node => !node.depleted && node.tileX === tileX && node.tileY === tileY)) return false

    const aiBuildings = [...this.buildingSystem.buildings.values()].filter(b => b.faction === 'ai')
    return aiBuildings.every(building => {
      const distance = Math.abs(building.tileX - tileX) + Math.abs(building.tileY - tileY)
      return distance >= minSpacing
    })
  }

  private subtractCost(cost: ResourceCost): void {
    for (const [rType, amount] of Object.entries(cost)) {
      if (amount) this.resourceSystem.subtract('ai', rType as ResourceType, amount)
    }
  }

  private findBestGatherNode(worker: { x: number; y: number }): typeof this.resourceSystem.nodes[number] | null {
    let best = null as typeof this.resourceSystem.nodes[number] | null
    let bestDist = Number.POSITIVE_INFINITY

    for (const node of this.resourceSystem.nodes) {
      if (node.depleted) continue
      const nx = node.tileX * TILE_SIZE + TILE_SIZE / 2
      const ny = node.tileY * TILE_SIZE + TILE_SIZE / 2
      const dx = nx - worker.x
      const dy = ny - worker.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = node
      }
    }

    return best
  }

  private async consultClaude(): Promise<void> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          aiSoldiers:    this.combatSystem.getSoldiersOfFaction('ai').length,
          playerSoldiers: this.combatSystem.getSoldiersOfFaction('player').length,
          aiWorkers:     this.unitSystem.workers.filter(w => w.faction === 'ai').length,
          aiBuildings:   [...this.buildingSystem.buildings.values()]
            .filter(b => b.faction === 'ai')
            .map(b => ({ type: b.buildingType, built: b.built })),
        }),
      })
      clearTimeout(timeout)

      if (res.ok) {
        // Claude can suggest tactical adjustments — reserved for future use
        await res.json()
      }
    } catch {
      // Network errors / timeouts are silently ignored — rule-based AI continues
    }
  }
}
