import * as Phaser from 'phaser'
import { WORKER_RADIUS, WORKER_SPEED, TILE_SIZE } from '@/game/constants'
import type { WorkerState } from '@/types/units'
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

  // Pixel position of the home base for returning
  baseX: number
  baseY: number

  private onArrivedCallback: (() => void) | undefined
  private bodyGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number, baseX: number, baseY: number) {
    super(scene, x, y)

    this.baseX = baseX
    this.baseY = baseY

    this.bodyGfx = scene.add.graphics()
    this.selectionGfx = scene.add.graphics()

    // Body: filled blue circle
    this.bodyGfx.fillStyle(0x3b82f6, 1)
    this.bodyGfx.fillCircle(0, 0, WORKER_RADIUS)

    // Selection ring: white stroke circle, initially hidden
    this.selectionGfx.lineStyle(2, 0xffffff, 1)
    this.selectionGfx.strokeCircle(0, 0, WORKER_RADIUS + 4)
    this.selectionGfx.setVisible(false)

    this.add(this.bodyGfx)
    this.add(this.selectionGfx)

    scene.add.existing(this)
  }

  setSelected(selected: boolean): void {
    this.selectionGfx.setVisible(selected)
  }

  /**
   * Set this worker's movement target and state.
   * Named setMoveTarget to avoid collision with Phaser.GameObjects.Container.moveTo(child, index).
   */
  setMoveTarget(
    x: number,
    y: number,
    state: WorkerState = 'moving',
    onArrived?: () => void
  ): void {
    this.targetX = x
    this.targetY = y
    this.workerState = state
    this.onArrivedCallback = onArrived
  }

  update(delta: number): void {
    if (
      this.workerState === 'idle' ||
      this.workerState === 'gathering' ||
      this.workerState === 'building'
    ) {
      return
    }

    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 8) {
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
