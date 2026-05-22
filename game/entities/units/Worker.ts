import * as Phaser from 'phaser'
import { WORKER_RADIUS, WORKER_SPEED, TILE_SIZE } from '@/game/constants'
import { WAR2_ASSETS } from '@/game/assets/War2Assets'
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

  stuckTimer = 0
  lastCheckedX = 0
  lastCheckedY = 0

  private onArrivedCallback: (() => void) | undefined
  private waypoints: { x: number; y: number }[] = []
  private shadowGfx: Phaser.GameObjects.Graphics
  private sprite: Phaser.GameObjects.Image | null = null
  private bodyGfx: Phaser.GameObjects.Graphics
  private workGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics
  private workAnimMs = 0

  constructor(scene: Phaser.Scene, x: number, y: number, baseX: number, baseY: number, faction: Faction = 'player') {
    super(scene, x, y)

    this.baseX = baseX
    this.baseY = baseY
    this.faction = faction

    this.shadowGfx = scene.add.graphics()
    this.bodyGfx = scene.add.graphics()
    this.workGfx = scene.add.graphics()
    if (scene.textures.exists(WAR2_ASSETS.units.worker)) {
      // Top-down sprite points east at rotation 0; rotate only the sprite, not the whole container.
      this.sprite = scene.add.image(0, 0, WAR2_ASSETS.units.worker).setOrigin(0.5, 0.5).setScale(0.72)
      if (faction === 'ai') this.sprite.setTint(0xff9d9d)
    }
    this.selectionGfx = scene.add.graphics()

    const bodyColor = faction === 'player' ? 0x3b82f6 : 0xef4444
    const trimColor = faction === 'player' ? 0xbfdbfe : 0xfecaca

    this.shadowGfx.fillStyle(0x020617, 0.35)
    this.shadowGfx.fillEllipse(2, 7, WORKER_RADIUS * 2.2, 8)

    if (!this.sprite) {
      this.bodyGfx.fillStyle(bodyColor, 1)
      this.bodyGfx.fillCircle(0, 0, WORKER_RADIUS)
      this.bodyGfx.fillStyle(trimColor, 0.95)
      this.bodyGfx.fillCircle(-3, -3, 3)
      this.bodyGfx.lineStyle(2, trimColor, 0.9)
      this.bodyGfx.lineBetween(4, -9, 9, -14)
      this.bodyGfx.lineStyle(2, 0x92400e, 1)
      this.bodyGfx.lineBetween(5, 6, 12, 12)
      this.bodyGfx.lineStyle(2, 0xfbbf24, 1)
      this.bodyGfx.lineBetween(9, 5, 14, 10)
    }

    this.selectionGfx.lineStyle(2, 0xffffff, 1)
    this.selectionGfx.strokeCircle(0, 0, WORKER_RADIUS + 5)
    this.selectionGfx.lineStyle(1, faction === 'player' ? 0x60a5fa : 0xf87171, 0.8)
    this.selectionGfx.strokeCircle(0, 0, WORKER_RADIUS + 8)
    this.selectionGfx.setVisible(false)

    this.add(this.shadowGfx)
    if (this.sprite) this.add(this.sprite)
    this.add(this.bodyGfx)
    this.add(this.workGfx)
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
    if (this.workerState === 'gathering' || this.workerState === 'building' || this.workerState === 'repairing') {
      this.updateWorkAnimation(delta)
      return
    }

    if (this.workAnimMs !== 0 || this.workGfx.visible) this.stopWorkAnimation()
    if (this.workerState === 'idle') return

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
    const angle = Math.atan2(dy, dx)
    if (this.sprite) {
      this.sprite.rotation = Phaser.Math.Angle.RotateTo(this.sprite.rotation, angle, 0.12)
    } else {
      this.bodyGfx.rotation = Phaser.Math.Angle.RotateTo(this.bodyGfx.rotation, angle, 0.12)
    }
  }

  depositResources(): { type: ResourceType; amount: number } | null {
    if (this.carryType === null || this.carryAmount === 0) return null
    const result = { type: this.carryType, amount: this.carryAmount }
    this.carryAmount = 0
    this.carryType = null
    return result
  }

  private updateWorkAnimation(delta: number): void {
    this.workAnimMs += delta
    this.workGfx.setVisible(true)
    this.workGfx.clear()

    const target = this.getWorkTarget()
    const angle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.sprite?.rotation ?? 0
    const phase = (this.workAnimMs % 520) / 520
    const swing = Math.sin(phase * Math.PI * 2)
    const forward = 13 + Math.max(0, swing) * 6
    const side = 5 + swing * 3
    const tipX = Math.cos(angle) * forward + Math.cos(angle + Math.PI / 2) * side
    const tipY = Math.sin(angle) * forward + Math.sin(angle + Math.PI / 2) * side

    if (this.sprite) {
      this.sprite.rotation = Phaser.Math.Angle.RotateTo(this.sprite.rotation, angle, 0.18)
      const squash = Math.max(0, swing) * 0.035
      this.sprite.setScale(0.72 + squash, 0.72 - squash * 0.7)
    }

    const isWood = this.workerState === 'gathering' && this.targetNode?.type === 'wood'
    const toolColor = isWood ? 0xd6c08b : 0xb7c0c2
    this.workGfx.lineStyle(3, 0x21160d, 0.85)
    this.workGfx.lineBetween(0, 0, tipX, tipY)
    this.workGfx.lineStyle(2, toolColor, 1)
    this.workGfx.lineBetween(0, 0, tipX, tipY)

    if (swing > 0.7) {
      this.workGfx.fillStyle(isWood ? 0xa16207 : 0xd1d5db, 0.9)
      this.workGfx.fillCircle(tipX, tipY, 2)
      this.workGfx.fillStyle(0xfacc15, 0.7)
      this.workGfx.fillCircle(tipX + Math.cos(angle - 0.8) * 5, tipY + Math.sin(angle - 0.8) * 5, 1.5)
    }
  }

  private stopWorkAnimation(): void {
    this.workAnimMs = 0
    this.workGfx.clear()
    this.workGfx.setVisible(false)
    if (this.sprite) this.sprite.setScale(0.72)
  }

  private getWorkTarget(): { x: number; y: number } | null {
    if (this.workerState === 'gathering' && this.targetNode) {
      return {
        x: this.targetNode.tileX * TILE_SIZE + TILE_SIZE / 2,
        y: this.targetNode.tileY * TILE_SIZE + TILE_SIZE / 2,
      }
    }
    if ((this.workerState === 'building' || this.workerState === 'repairing') && this.targetBuilding) {
      return { x: this.targetBuilding.x, y: this.targetBuilding.y }
    }
    return null
  }

  getWorldTile(): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(this.x / TILE_SIZE),
      tileY: Math.floor(this.y / TILE_SIZE),
    }
  }
}
