import * as Phaser from 'phaser'
import { WORKER_RADIUS, WORKER_SPEED, TILE_SIZE } from '@/game/constants'
import type { WorkerState, Faction } from '@/types/units'
import type { ResourceType, ResourceNode } from '@/types/resources'
import type { Building } from '@/game/entities/buildings/Building'

export class Worker extends Phaser.GameObjects.Container {
  workerState: WorkerState = 'idle'
  targetX: number = 0
  targetY: number = 0
  targetNode: ResourceNode | null = null
  carryAmount: number = 0
  carryType: ResourceType | null = null
  targetBuilding: Building | null = null
  faction: Faction

  baseX: number
  baseY: number

  private onArrivedCallback: (() => void) | undefined
  private waypoints: { x: number; y: number }[] = []
  private bodyGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number, baseX: number, baseY: number, faction: Faction = 'player') {
    super(scene, x, y)

    this.baseX = baseX
    this.baseY = baseY
    this.faction = faction

    this.bodyGfx = scene.add.graphics()
    this.selectionGfx = scene.add.graphics()

    const bodyColor = faction === 'player' ? 0x3b82f6 : 0xef4444
    this.bodyGfx.fillStyle(bodyColor, 1)
    this.bodyGfx.fillCircle(0, 0, WORKER_RADIUS)

    this.selectionGfx.lineStyle(2, 0xffffff, 1)
    this.selectionGfx.strokeCircle(0, 0, WORKER_RADIUS + 4)
    this.selectionGfx.setVisible(false)

    this.add(this.bodyGfx)
    this.add(this.selectionGfx)

    scene.add.existing(this)
    this.setDepth(2)
  }

  setSelected(selected: boolean): void {
    this.selectionGfx.setVisible(selected)
  }

  setMoveTarget(x: number, y: number, state: WorkerState = 'moving', onArrived?: () => void): void {
    this.waypoints = []
    this.targetX = x
    this.targetY = y
    this.workerState = state
    this.onArrivedCallback = onArrived
  }

  setPath(waypoints: { x: number; y: number }[], state: WorkerState, onArrived?: () => void): void {
    if (waypoints.length === 0) { if (onArrived) onArrived(); return }
    this.targetX = waypoints[0].x
    this.targetY = waypoints[0].y
    this.waypoints = waypoints.slice(1)
    this.workerState = state
    this.onArrivedCallback = onArrived
  }

  update(delta: number): void {
    if (this.workerState === 'idle' || this.workerState === 'gathering' || this.workerState === 'building') return

    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 8) {
      if (this.waypoints.length > 0) {
        const next = this.waypoints.shift()!
        this.targetX = next.x
        this.targetY = next.y
        return
      }
      this.x = this.targetX
      this.y = this.targetY
      const cb = this.onArrivedCallback
      this.onArrivedCallback = undefined
      if (cb) cb()
      return
    }

    const speed = (WORKER_SPEED * delta) / 1000
    const ratio = Math.min(speed / dist, 1)
    this.x += dx * ratio
    this.y += dy * ratio
  }

  depositResources(): { type: ResourceType; amount: number } | null {
    if (this.carryType === null || this.carryAmount === 0) return null
    const result = { type: this.carryType, amount: this.carryAmount }
    this.carryAmount = 0
    this.carryType = null
    return result
  }

  getWorldTile(): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(this.x / TILE_SIZE),
      tileY: Math.floor(this.y / TILE_SIZE),
    }
  }
}
