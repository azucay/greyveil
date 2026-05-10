import * as Phaser from 'phaser'
import { EventBus } from '@/game/EventBus'
import { Worker } from '@/game/entities/units/Worker'
import { Soldier } from '@/game/entities/units/Soldier'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { MapSystem } from '@/game/systems/MapSystem'
import { CombatSystem } from '@/game/systems/CombatSystem'
import { WORKER_RADIUS, GATHER_RATE, CARRY_CAPACITY, TILE_SIZE } from '@/game/constants'
import { SOLDIER_CONFIGS } from '@/types/units'
import type { ResourceNode, Resources } from '@/types/resources'
import type { Building } from '@/game/entities/buildings/Building'
import type { Faction, SoldierType } from '@/types/units'

const WORKER_TRAIN_TIME = 10000

export class UnitSystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  private buildingSystem: BuildingSystem
  private mapSystem: MapSystem
  private combatSystem: CombatSystem

  workers: Worker[] = []
  trainingTimer: number | null = null

  private soldierTraining: Map<string, { type: SoldierType; timer: number; faction: Faction }> = new Map()
  private gatherAccum: WeakMap<Worker, number> = new WeakMap()

  constructor(
    scene: Phaser.Scene,
    resourceSystem: ResourceSystem,
    buildingSystem: BuildingSystem,
    mapSystem: MapSystem,
    combatSystem: CombatSystem
  ) {
    this.scene = scene
    this.resourceSystem = resourceSystem
    this.buildingSystem = buildingSystem
    this.mapSystem = mapSystem
    this.combatSystem = combatSystem
  }

  spawnWorker(x: number, y: number, baseX: number, baseY: number, faction: Faction = 'player'): void {
    const w = new Worker(this.scene, x, y, baseX, baseY, faction)
    this.workers.push(w)
    this.gatherAccum.set(w, 0)
    if (faction === 'player') EventBus.emit<number>('pop-changed', this.popCount)
  }

  commandGather(worker: Worker, node: ResourceNode): void {
    const gotoNode = (): void => {
      if (node.depleted) { worker.workerState = 'idle'; worker.targetNode = null; return }
      worker.targetNode = node
      const from = worker.getWorldTile()
      const path = this.mapSystem.findPath(from.tileX, from.tileY, node.tileX, node.tileY)
      if (path.length === 0) { worker.workerState = 'idle'; return }
      worker.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })), 'moving', () => {
        if (node.depleted) { worker.workerState = 'idle'; worker.targetNode = null; return }
        worker.workerState = 'gathering'
        this.gatherAccum.set(worker, 0)
      })
    }

    const returnToBase = (): void => {
      const from = worker.getWorldTile()
      const baseTileX = Math.floor(worker.baseX / TILE_SIZE)
      const baseTileY = Math.floor(worker.baseY / TILE_SIZE)
      if (!this.buildingSystem.getBuildingAt(baseTileX, baseTileY)) {
        worker.carryAmount = 0; worker.carryType = null
        worker.workerState = 'idle'; worker.targetNode = null
        return
      }
      const path = this.mapSystem.findPath(from.tileX, from.tileY, baseTileX, baseTileY)
      if (path.length === 0) { worker.workerState = 'idle'; return }
      worker.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })), 'returning', () => {
        const deposit = worker.depositResources()
        if (deposit) {
          this.resourceSystem.add(worker.faction, deposit.type, deposit.amount)
          if (worker.faction === 'player') {
            EventBus.emit<Resources>('resources-updated', this.resourceSystem.getPlayerResources())
          }
        }
        if (!node.depleted) gotoNode()
        else { worker.workerState = 'idle'; worker.targetNode = null }
      })
    }

    gotoNode()
    ;(worker as WorkerWithGatherCb)._returnToBase = returnToBase
  }

  commandMove(worker: Worker, x: number, y: number): void {
    const from = worker.getWorldTile()
    const toTileX = Math.floor(x / TILE_SIZE)
    const toTileY = Math.floor(y / TILE_SIZE)
    const path = this.mapSystem.findPath(from.tileX, from.tileY, toTileX, toTileY)
    if (path.length === 0) return
    worker.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })), 'moving', () => { worker.workerState = 'idle' })
  }

  commandBuild(worker: Worker, building: Building): void {
    worker.targetBuilding = building
    const from = worker.getWorldTile()
    const path = this.mapSystem.findPath(from.tileX, from.tileY, building.tileX, building.tileY)
    if (path.length === 0) { worker.workerState = 'idle'; return }
    worker.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })), 'moving_to_build', () => {
      worker.workerState = 'building'
    })
  }

  startTraining(townHall: Building): void {
    if (this.trainingTimer !== null) return
    if (!this.resourceSystem.canAfford('player', { wood: 50 })) return
    this.resourceSystem.subtract('player', 'wood', 50)
    this.trainingTimer = 0
    EventBus.emit<{ progress: number } | null>('training-update', { progress: 0 })
  }

  startTrainingSoldier(barracks: Building, type: SoldierType, faction: Faction = 'player'): void {
    const key = `${barracks.tileX},${barracks.tileY}`
    if (this.soldierTraining.has(key)) return
    const cfg = SOLDIER_CONFIGS[type]
    if (!this.resourceSystem.canAfford(faction, cfg.cost)) return
    for (const [rType, amount] of Object.entries(cfg.cost)) {
      this.resourceSystem.subtract(faction, rType as keyof Resources, amount as number)
    }
    this.soldierTraining.set(key, { type, timer: 0, faction })
    if (faction === 'player') EventBus.emit<Resources>('resources-updated', this.resourceSystem.getPlayerResources())
  }

  getSoldierTraining(barracks: Building): { soldierType: SoldierType; progress: number } | null {
    const key = `${barracks.tileX},${barracks.tileY}`
    const t = this.soldierTraining.get(key)
    if (!t) return null
    return { soldierType: t.type, progress: t.timer / SOLDIER_CONFIGS[t.type].trainTime }
  }

  private gatherTick(worker: Worker, delta: number): void {
    const node = worker.targetNode
    if (!node || node.depleted) { worker.workerState = 'idle'; worker.targetNode = null; return }

    const accum = (this.gatherAccum.get(worker) ?? 0) + (GATHER_RATE * delta) / 1000
    this.gatherAccum.set(worker, accum)
    const toGather = Math.floor(accum)
    if (toGather > 0) {
      this.gatherAccum.set(worker, accum - toGather)
      const actualGather = Math.min(toGather, node.amount, CARRY_CAPACITY - worker.carryAmount)
      node.amount -= actualGather
      worker.carryAmount += actualGather
      if (worker.carryType === null) worker.carryType = node.type
      if (node.amount <= 0) { node.amount = 0; this.resourceSystem.depleteNode(node.id) }
    }

    if (worker.carryAmount >= CARRY_CAPACITY || node.depleted || node.amount <= 0) {
      const returnCb = (worker as WorkerWithGatherCb)._returnToBase
      if (returnCb) returnCb()
    }
  }

  update(delta: number): void {
    for (const worker of this.workers) {
      worker.update(delta)
      if (worker.workerState === 'gathering') this.gatherTick(worker, delta)
      if (worker.workerState === 'building' && worker.targetBuilding) {
        worker.targetBuilding.tick(delta)
        if (worker.targetBuilding.built) { worker.workerState = 'idle'; worker.targetBuilding = null }
      }
    }

    if (this.trainingTimer !== null) {
      this.trainingTimer += delta
      const progress = Math.min(this.trainingTimer / WORKER_TRAIN_TIME, 1)
      EventBus.emit<{ progress: number } | null>('training-update', { progress })
      if (this.trainingTimer >= WORKER_TRAIN_TIME) {
        const th = this.buildingSystem.getTownHall('player')
        if (th) this.spawnWorker(th.x + 60, th.y, th.x, th.y, 'player')
        this.trainingTimer = null
        EventBus.emit<{ progress: number } | null>('training-update', null)
      }
    }

    for (const [key, t] of this.soldierTraining) {
      t.timer += delta
      const cfg = SOLDIER_CONFIGS[t.type]
      if (t.timer >= cfg.trainTime) {
        this.soldierTraining.delete(key)
        const [tx, ty] = key.split(',').map(Number)
        const barracks = this.buildingSystem.getBuildingAt(tx, ty)
        if (barracks) {
          const soldier = new Soldier(this.scene, barracks.x + 50, barracks.y, t.type, t.faction)
          this.combatSystem.addSoldier(soldier)
        }
      }
    }
  }

  getWorkerAt(worldX: number, worldY: number): Worker | null {
    for (const worker of this.workers) {
      const dx = worker.x - worldX
      const dy = worker.y - worldY
      if (Math.sqrt(dx * dx + dy * dy) <= WORKER_RADIUS + 10) return worker
    }
    return null
  }

  get popCount(): number { return this.workers.filter(w => w.faction === 'player').length }
  get popCap(): number { return 10 + this.buildingSystem.getBuiltCount('farm', 'player') * 10 }
}

interface WorkerWithGatherCb extends Worker {
  _returnToBase?: () => void
}
