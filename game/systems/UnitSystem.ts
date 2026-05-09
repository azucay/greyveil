import * as Phaser from 'phaser'
import { EventBus } from '@/game/EventBus'
import { Worker } from '@/game/entities/units/Worker'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import { WORKER_RADIUS, GATHER_RATE, CARRY_CAPACITY, TILE_SIZE } from '@/game/constants'
import type { ResourceNode, Resources } from '@/types/resources'
import type { Building } from '@/game/entities/buildings/Building'

const TRAINING_TIME = 10000

export class UnitSystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  private buildingSystem: BuildingSystem

  workers: Worker[] = []
  trainingTimer: number | null = null

  // Per-worker gather accumulators (keyed by worker via WeakMap)
  private gatherAccum: WeakMap<Worker, number> = new WeakMap()

  constructor(
    scene: Phaser.Scene,
    resourceSystem: ResourceSystem,
    buildingSystem: BuildingSystem
  ) {
    this.scene = scene
    this.resourceSystem = resourceSystem
    this.buildingSystem = buildingSystem
  }

  spawnWorker(x: number, y: number, baseX: number, baseY: number): void {
    const w = new Worker(this.scene, x, y, baseX, baseY)
    this.workers.push(w)
    this.gatherAccum.set(w, 0)
    EventBus.emit<number>('pop-changed', this.popCount)
  }

  commandGather(worker: Worker, node: ResourceNode): void {
    const nodeWorldX = node.tileX * TILE_SIZE + TILE_SIZE / 2
    const nodeWorldY = node.tileY * TILE_SIZE + TILE_SIZE / 2

    const gotoNode = (): void => {
      if (node.depleted) {
        worker.workerState = 'idle'
        worker.targetNode = null
        return
      }
      worker.targetNode = node
      worker.setMoveTarget(nodeWorldX, nodeWorldY, 'moving', () => {
        if (node.depleted) {
          worker.workerState = 'idle'
          worker.targetNode = null
          return
        }
        worker.workerState = 'gathering'
        this.gatherAccum.set(worker, 0)
      })
    }

    const returnToBase = (): void => {
      worker.setMoveTarget(worker.baseX, worker.baseY, 'returning', () => {
        const deposit = worker.depositResources()
        if (deposit) {
          this.resourceSystem.add('player', deposit.type, deposit.amount)
          EventBus.emit<Resources>('resources-updated', this.resourceSystem.getPlayerResources())
        }
        if (!node.depleted) {
          gotoNode()
        } else {
          worker.workerState = 'idle'
          worker.targetNode = null
        }
      })
    }

    // Trigger the chain
    gotoNode()

    // Store returnToBase reference on worker via a typed extension
    ;(worker as WorkerWithGatherCb)._returnToBase = returnToBase
  }

  commandMove(worker: Worker, x: number, y: number): void {
    worker.setMoveTarget(x, y, 'moving', () => {
      worker.workerState = 'idle'
    })
  }

  commandBuild(worker: Worker, building: Building): void {
    worker.targetBuilding = building
    const bx = building.x
    const by = building.y
    worker.setMoveTarget(bx, by, 'moving_to_build', () => {
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

  private gatherTick(worker: Worker, delta: number): void {
    const node = worker.targetNode
    if (!node || node.depleted) {
      worker.workerState = 'idle'
      worker.targetNode = null
      return
    }

    const accum = (this.gatherAccum.get(worker) ?? 0) + (GATHER_RATE * delta) / 1000
    this.gatherAccum.set(worker, accum)

    const toGather = Math.floor(accum)
    if (toGather > 0) {
      this.gatherAccum.set(worker, accum - toGather)

      const actualGather = Math.min(toGather, node.amount, CARRY_CAPACITY - worker.carryAmount)
      node.amount -= actualGather
      worker.carryAmount += actualGather
      if (worker.carryType === null) {
        worker.carryType = node.type
      }

      if (node.amount <= 0) {
        node.amount = 0
        this.resourceSystem.depleteNode(node.id)
      }
    }

    const carryFull = worker.carryAmount >= CARRY_CAPACITY
    const nodeDepleted = node.depleted || node.amount <= 0

    if (carryFull || nodeDepleted) {
      const returnCb = (worker as WorkerWithGatherCb)._returnToBase
      if (returnCb) {
        returnCb()
      }
    }
  }

  update(delta: number): void {
    for (const worker of this.workers) {
      worker.update(delta)

      if (worker.workerState === 'gathering') {
        this.gatherTick(worker, delta)
      }

      if (worker.workerState === 'building' && worker.targetBuilding) {
        worker.targetBuilding.tick(delta)
        if (worker.targetBuilding.built) {
          worker.workerState = 'idle'
          worker.targetBuilding = null
        }
      }
    }

    if (this.trainingTimer !== null) {
      this.trainingTimer += delta
      const progress = Math.min(this.trainingTimer / TRAINING_TIME, 1)
      EventBus.emit<{ progress: number } | null>('training-update', { progress })

      if (this.trainingTimer >= TRAINING_TIME) {
        const th = this.buildingSystem.getTownHall('player')
        if (th) {
          const spawnX = th.x + 60
          const spawnY = th.y
          this.spawnWorker(spawnX, spawnY, th.x, th.y)
        }
        this.trainingTimer = null
        EventBus.emit<{ progress: number } | null>('training-update', null)
      }
    }
  }

  getWorkerAt(worldX: number, worldY: number): Worker | null {
    for (const worker of this.workers) {
      const dx = worker.x - worldX
      const dy = worker.y - worldY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= WORKER_RADIUS + 10) {
        return worker
      }
    }
    return null
  }

  get popCount(): number {
    return this.workers.length
  }

  get popCap(): number {
    return 10 + this.buildingSystem.getBuiltCount('farm', 'player') * 10
  }
}

// Helper interface for closure-based gather return callback
interface WorkerWithGatherCb extends Worker {
  _returnToBase?: () => void
}
