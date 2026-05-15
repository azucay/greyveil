import * as Phaser from 'phaser'
import { Building } from '@/game/entities/buildings/Building'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { UnitSystem } from '@/game/systems/UnitSystem'
import { CombatSystem } from '@/game/systems/CombatSystem'
import { MapSystem } from '@/game/systems/MapSystem'
import { BUILDING_CONFIGS } from '@/types/buildings'
import { AI_START_TILE, TILE_SIZE } from '@/game/constants'
import type { BuildingType } from '@/types/buildings'

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

    const hasFarm       = aiBuildings.some(b => b.buildingType === 'farm')
    const hasMine       = aiBuildings.some(b => b.buildingType === 'mine')
    const barracks      = aiBuildings.filter(b => b.buildingType === 'barracks')
    const builtBarracks = barracks.filter(b => b.built)
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
    if (livingWorkers.length < 2 && aiTH && !this.unitSystem.trainingTimer) {
      this.unitSystem.startTraining(aiTH, 'ai')
    }

    // Always keep idle workers gathering unless they are needed for building completion.
    for (const worker of idleWorkers) {
      const node = this.resourceSystem.nodes.find(n => !n.depleted)
      if (node) this.unitSystem.commandGather(worker, node)
    }

    if (unfinishedBuildings.length > 0) return

    // Economy: farm first — food is needed for swordsman training
    if (!hasFarm && res.canAfford('ai', { wood: 60 })) {
      this.buildAIBuilding('farm')
      return
    }

    // Economy: mine — metal for swordsmen and archers
    if (!hasMine && res.canAfford('ai', { wood: 80, stone: 60 })) {
      this.buildAIBuilding('mine')
      return
    }

    // Military: build first barracks
    if (barracks.length === 0 && res.canAfford('ai', { wood: 100, stone: 80 })) {
      this.buildAIBuilding('barracks')
      return
    }

    // Military: build second barracks once first is operational and army is forming
    if (barracks.length === 1 && builtBarracks.length === 1 && aiSoldiers.length >= 3 &&
        res.canAfford('ai', { wood: 100, stone: 80 })) {
      this.buildAIBuilding('barracks')
    }

    // Military: continuously train in all built barracks
    for (const b of builtBarracks) {
      if (this.unitSystem.getSoldierTraining(b)) continue
      if (aiSoldiers.length >= 4 && res.canAfford('ai', { wood: 30, metal: 30 })) {
        this.unitSystem.startTrainingSoldier(b, 'archer', 'ai')
      } else if (res.canAfford('ai', { metal: 50, food: 20 })) {
        this.unitSystem.startTrainingSoldier(b, 'swordsman', 'ai')
      }
    }

    // Military: attack — threshold lowers if player has many soldiers
    const playerCount     = this.combatSystem.getSoldiersOfFaction('player').length
    const attackThreshold = playerCount >= 3 ? 3 : 5
    if (playerTH && aiSoldiers.length >= attackThreshold && this.attackCooldown <= 0) {
      const wave = aiSoldiers.filter(soldier => soldier.state === 'idle')
      if (wave.length > 0) {
        this.combatSystem.commandAttack(wave, playerTH)
        this.attackCooldown = this.ATTACK_WAVE_COOLDOWN
      }
    }
  }

  private buildAIBuilding(type: BuildingType): void {
    const cost = BUILDING_CONFIGS[type].cost
    const aiWorkers = this.unitSystem.workers.filter(w => w.faction === 'ai')
    const base = this.buildingSystem.getTownHall('ai')
    const cx = base ? base.tileX : AI_START_TILE.x
    const cy = base ? base.tileY : AI_START_TILE.y

    for (let radius = 2; radius <= 10; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          const tx = cx + dx
          const ty = cy + dy
          if (!this.mapSystem.isWalkable(tx, ty)) continue
          if (this.buildingSystem.isTileOccupied(tx, ty)) continue

          const building = new Building(this.scene, type, 'ai', tx, ty)
          this.buildingSystem.addBuilding(building, tx, ty)

          for (const [rType, amount] of Object.entries(cost)) {
            if (amount) this.resourceSystem.subtract('ai', rType as keyof typeof cost, amount)
          }

          const builder = aiWorkers.find(w => w.workerState === 'idle')
            ?? aiWorkers.find(w => w.workerState === 'gathering' || w.workerState === 'returning')
          if (builder) this.unitSystem.commandBuild(builder, building)
          return
        }
      }
    }
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
