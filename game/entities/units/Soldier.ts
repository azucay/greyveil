import * as Phaser from 'phaser'
import { WAR2_ASSETS } from '@/game/assets/War2Assets'
import { SOLDIER_CONFIGS } from '@/types/units'
import type { SoldierType, SoldierState, Faction } from '@/types/units'
import type { Building } from '@/game/entities/buildings/Building'

export class Soldier extends Phaser.GameObjects.Container {
  faction: Faction
  soldierType: SoldierType
  state: SoldierState = 'idle'

  hp: number
  maxHp: number
  damage: number
  attackRange: number
  speed: number

  target: Soldier | Building | null = null
  attackTimer: number = 0

  private targetX: number = 0
  private targetY: number = 0
  private waypoints: { x: number; y: number }[] = []
  private onArrivedCallback?: () => void

  private sprite: Phaser.GameObjects.Image | null = null
  private bodyGfx: Phaser.GameObjects.Graphics
  private hpBarGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number, soldierType: SoldierType, faction: Faction) {
    super(scene, x, y)
    this.faction = faction
    this.soldierType = soldierType

    const cfg = SOLDIER_CONFIGS[soldierType]
    this.hp = cfg.hp
    this.maxHp = cfg.hp
    this.damage = cfg.damage
    this.attackRange = cfg.range
    this.speed = cfg.speed

    this.bodyGfx = scene.add.graphics()
    const spriteKey = soldierType === 'archer' ? WAR2_ASSETS.units.archer : WAR2_ASSETS.units.swordsman
    const fallbackKey = WAR2_ASSETS.units.soldier
    const textureKey = scene.textures.exists(spriteKey) ? spriteKey : fallbackKey
    if (scene.textures.exists(textureKey)) {
      this.sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5, 0.5).setScale(soldierType === 'archer' ? 0.74 : 0.78)
      if (faction === 'ai') this.sprite.setTint(0xff9d9d)
    }
    this.hpBarGfx = scene.add.graphics()
    this.selectionGfx = scene.add.graphics()

    const color = faction === 'player' ? 0x3b82f6 : 0xef4444
    const accent = faction === 'player' ? 0xdbeafe : 0xfee2e2
    if (!this.sprite) {
      this.bodyGfx.fillStyle(color, 1)
      if (soldierType === 'swordsman') {
        this.bodyGfx.fillCircle(0, 0, cfg.radius)
        this.bodyGfx.lineStyle(3, accent, 1)
        this.bodyGfx.lineBetween(-4, 7, 7, -8)
        this.bodyGfx.lineStyle(2, accent, 0.9)
        this.bodyGfx.lineBetween(-8, 2, 2, 8)
      } else {
        this.bodyGfx.fillTriangle(0, -cfg.radius - 1, cfg.radius + 2, cfg.radius, -cfg.radius - 2, cfg.radius)
        this.bodyGfx.lineStyle(2, accent, 1)
        this.bodyGfx.beginPath()
        this.bodyGfx.arc(0, 1, cfg.radius + 2, -1.15, 1.15, false)
        this.bodyGfx.strokePath()
        this.bodyGfx.lineBetween(5, -6, 5, 8)
      }
    }

    this.selectionGfx.lineStyle(2, 0xffffff, 1)
    this.selectionGfx.strokeCircle(0, 0, cfg.radius + 4)
    this.selectionGfx.setVisible(false)

    if (this.sprite) this.add(this.sprite)
    this.add(this.bodyGfx)
    this.add(this.hpBarGfx)
    this.add(this.selectionGfx)

    scene.add.existing(this)
    this.setDepth(3)

    this.drawHpBar()
  }

  setSelected(selected: boolean): void {
    this.selectionGfx.setVisible(selected)
  }

  setMoveTarget(x: number, y: number, onArrived?: () => void): void {
    this.waypoints = []
    this.targetX = x
    this.targetY = y
    this.state = 'moving'
    this.onArrivedCallback = onArrived
  }

  setPath(waypoints: { x: number; y: number }[], onArrived?: () => void): void {
    if (waypoints.length === 0) { if (onArrived) onArrived(); return }
    this.targetX = waypoints[0].x
    this.targetY = waypoints[0].y
    this.waypoints = waypoints.slice(1)
    this.state = 'moving'
    this.onArrivedCallback = onArrived
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    this.drawHpBar()
    if (this.hp <= 0) {
      this.state = 'dead'
      this.destroy()
      return true
    }
    return false
  }

  playAttackFeedback(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.y, targetX - this.x)
    this.faceAngle(angle, 0.35)
    const lunge = this.soldierType === 'swordsman' ? 5 : 2
    this.scene.tweens.add({
      targets: this,
      x: this.x + Math.cos(angle) * lunge,
      y: this.y + Math.sin(angle) * lunge,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    })
  }

  private faceAngle(angle: number, step = 0.14): void {
    if (this.sprite) {
      this.sprite.rotation = Phaser.Math.Angle.RotateTo(this.sprite.rotation, angle, step)
    } else {
      this.bodyGfx.rotation = Phaser.Math.Angle.RotateTo(this.bodyGfx.rotation, angle, step)
    }
  }

  drawHpBar(): void {
    const cfg = SOLDIER_CONFIGS[this.soldierType]
    const w = cfg.radius * 2
    const ratio = this.hp / this.maxHp
    const barY = -(cfg.radius + 6)
    this.hpBarGfx.clear()
    this.hpBarGfx.fillStyle(0x000000, 0.6)
    this.hpBarGfx.fillRect(-w / 2, barY, w, 3)
    const barColor = ratio > 0.3 ? 0x22c55e : 0xef4444
    this.hpBarGfx.fillStyle(barColor, 1)
    this.hpBarGfx.fillRect(-w / 2, barY, Math.ceil(w * ratio), 3)
  }

  update(delta: number): void {
    if (this.state === 'dead') return

    if (this.state === 'moving') {
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
        else this.state = 'idle'
        return
      }

      const speed = (this.speed * delta) / 1000
      const ratio = Math.min(speed / dist, 1)
      this.x += dx * ratio
      this.y += dy * ratio
      this.faceAngle(Math.atan2(dy, dx))
    }
  }

  getWorldTile(): { tileX: number; tileY: number } {
    const { TILE_SIZE } = require('@/game/constants')
    return { tileX: Math.floor(this.x / TILE_SIZE), tileY: Math.floor(this.y / TILE_SIZE) }
  }
}
