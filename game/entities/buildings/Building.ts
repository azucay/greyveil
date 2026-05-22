import * as Phaser from 'phaser'
import { TILE_SIZE } from '@/game/constants'
import { WAR2_ASSETS } from '@/game/assets/War2Assets'
import { BUILDING_CONFIGS } from '@/types/buildings'
import type { BuildingType } from '@/types/buildings'
import type { Faction } from '@/types/units'

export class Building extends Phaser.GameObjects.Container {
  buildingType: BuildingType
  faction: Faction
  hp: number
  maxHp: number
  buildProgress: number
  built: boolean
  tileX: number
  tileY: number
  attackTimer = 0

  private sprite: Phaser.GameObjects.Image | null = null
  private bodyGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics
  private progressGfx: Phaser.GameObjects.Graphics
  private damageGfx: Phaser.GameObjects.Graphics
  private labelBgGfx: Phaser.GameObjects.Graphics
  private labelText: Phaser.GameObjects.Text
  private repairFxTimer = 0

  constructor(
    scene: Phaser.Scene,
    buildingType: BuildingType,
    faction: Faction,
    tileX: number,
    tileY: number
  ) {
    const config = BUILDING_CONFIGS[buildingType]
    const worldX = tileX * TILE_SIZE + TILE_SIZE / 2
    const worldY = tileY * TILE_SIZE + TILE_SIZE / 2

    super(scene, worldX, worldY)

    this.buildingType = buildingType
    this.faction = faction
    this.tileX = tileX
    this.tileY = tileY
    this.maxHp = config.hp
    this.hp = config.hp
    this.buildProgress = buildingType === 'townhall' ? 1 : 0
    this.built = buildingType === 'townhall'

    this.bodyGfx = scene.add.graphics()
    const spriteKey = WAR2_ASSETS.buildings[buildingType]
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey).setOrigin(0.5, 0.62)
      this.sprite.setScale(Math.min(config.width / this.sprite.width, config.height / this.sprite.height) * 1.22)
      this.sprite.setAlpha(this.built ? 1 : 0.48)
    }
    this.selectionGfx = scene.add.graphics()
    this.progressGfx = scene.add.graphics()
    this.damageGfx = scene.add.graphics()
    this.labelBgGfx = scene.add.graphics()

    const labelNames: Record<BuildingType, string> = {
      townhall: 'Rathaus', barracks: 'Kaserne', farm: 'Farm', mine: 'Mine', watchtower: 'Wachturm',
    }
    const hh = config.height / 2
    this.labelText = scene.add.text(0, hh + 9, labelNames[buildingType], {
      fontSize: '12px', color: '#f8fafc', fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#020617', strokeThickness: 3,
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0)

    if (this.sprite) this.add(this.sprite)
    this.add(this.bodyGfx)
    this.add(this.damageGfx)
    this.add(this.selectionGfx)
    this.add(this.progressGfx)
    this.add(this.labelBgGfx)
    this.add(this.labelText)

    scene.add.existing(this)
    this.setDepth(1)

    this.drawBody()
    this.drawLabel()
  }

  private drawBody(): void {
    const config = BUILDING_CONFIGS[this.buildingType]
    const { width, height } = config
    const color = this.faction === 'player' ? config.color : 0xef4444
    const alpha = this.built ? 1 : 0.5
    const hw = width / 2
    const hh = height / 2

    this.bodyGfx.clear()

    if (this.sprite) {
      this.sprite.setAlpha(alpha)
      if (this.faction === 'ai') this.sprite.setTint(0xffb4b4)
      else this.sprite.clearTint()
      this.bodyGfx.fillStyle(0x000000, 0.22)
      this.bodyGfx.fillEllipse(0, hh - 7, width * 0.9, 18)
      this.drawDamageState()
      return
    }

    // Shadow
    this.bodyGfx.fillStyle(0x000000, 0.4)
    this.bodyGfx.fillRect(-hw + 3, -hh + 3, width, height)

    // Fill: still pure Phaser Graphics, but no longer plain rectangles.
    this.bodyGfx.fillStyle(color, alpha)
    if (this.buildingType === 'watchtower') {
      this.bodyGfx.fillRect(-hw + 3, -hh + 12, width - 6, height - 12)
      this.bodyGfx.fillRect(-hw - 5, -hh, width + 10, 16)
      this.bodyGfx.fillStyle(this.faction === 'player' ? 0xfbbf24 : 0xfca5a5, alpha)
      this.bodyGfx.fillTriangle(-9, -hh + 4, 9, -hh + 4, 0, -hh - 12)
      this.bodyGfx.lineStyle(2, 0x422006, alpha)
      this.bodyGfx.lineBetween(-hw + 6, hh - 3, -hw + 14, -hh + 13)
      this.bodyGfx.lineBetween(hw - 6, hh - 3, hw - 14, -hh + 13)
    } else if (this.buildingType === 'townhall') {
      this.bodyGfx.fillRoundedRect(-hw, -hh + 7, width, height - 7, 5)
      this.bodyGfx.fillStyle(this.faction === 'player' ? 0x64748b : 0x991b1b, alpha)
      this.bodyGfx.fillTriangle(-hw + 3, -hh + 9, 0, -hh - 11, hw - 3, -hh + 9)
      this.bodyGfx.fillStyle(0xf8fafc, alpha * 0.75)
      this.bodyGfx.fillRect(-5, hh - 13, 10, 13)
    } else if (this.buildingType === 'farm') {
      this.bodyGfx.fillRoundedRect(-hw, -hh, width, height, 5)
      this.bodyGfx.lineStyle(2, 0x86efac, alpha * 0.75)
      for (let y = -hh + 8; y < hh; y += 8) this.bodyGfx.lineBetween(-hw + 4, y, hw - 4, y + 2)
      this.bodyGfx.fillStyle(0xfacc15, alpha * 0.9)
      this.bodyGfx.fillCircle(hw - 8, -hh + 9, 4)
    } else if (this.buildingType === 'mine') {
      this.bodyGfx.fillRoundedRect(-hw, -hh + 8, width, height - 8, 5)
      this.bodyGfx.fillStyle(0x78716c, alpha)
      this.bodyGfx.fillTriangle(-hw + 4, -hh + 11, 0, -hh - 10, hw - 4, -hh + 11)
      this.bodyGfx.lineStyle(2, 0xfde68a, alpha * 0.8)
      this.bodyGfx.lineBetween(-9, -2, 9, -13)
      this.bodyGfx.lineBetween(6, -15, 12, -11)
    } else {
      this.bodyGfx.fillRoundedRect(-hw, -hh, width, height, 4)
      this.bodyGfx.fillStyle(0xf97316, alpha * 0.8)
      this.bodyGfx.fillTriangle(-hw + 5, -hh + 7, 0, -hh - 9, hw - 5, -hh + 7)
    }

    // Subtle faction header stripe
    this.bodyGfx.fillStyle(this.faction === 'player' ? 0x60a5fa : 0xfca5a5, alpha * 0.55)
    this.bodyGfx.fillRoundedRect(-hw + 3, -hh + 3, width - 6, 5, 3)

    // Border
    this.bodyGfx.lineStyle(2, this.faction === 'player' ? 0xbfdbfe : 0xfecaca, alpha * 0.7)
    if (this.buildingType === 'watchtower') {
      this.bodyGfx.strokeRect(-hw, -hh + 12, width, height - 12)
      this.bodyGfx.strokeRect(-hw - 4, -hh, width + 8, 16)
    } else {
      this.bodyGfx.strokeRoundedRect(-hw, -hh, width, height, 4)
    }

    this.drawDamageState()
  }

  private drawLabel(): void {
    const bounds = this.labelText.getBounds()
    const localX = this.labelText.x - this.labelText.displayOriginX
    const localY = this.labelText.y - this.labelText.displayOriginY
    const padX = 5
    const padY = 2

    this.labelBgGfx.clear()
    this.labelBgGfx.fillStyle(this.faction === 'player' ? 0x0f172a : 0x450a0a, 0.82)
    this.labelBgGfx.fillRoundedRect(localX - padX, localY - padY, bounds.width + padX * 2, bounds.height + padY * 2, 6)
    this.labelBgGfx.lineStyle(1, this.faction === 'player' ? 0x60a5fa : 0xf87171, 0.65)
    this.labelBgGfx.strokeRoundedRect(localX - padX, localY - padY, bounds.width + padX * 2, bounds.height + padY * 2, 6)
  }

  private drawDamageState(): void {
    const config = BUILDING_CONFIGS[this.buildingType]
    const ratio = this.hp / this.maxHp
    const hw = config.width / 2
    const hh = config.height / 2
    const barWidth = config.width
    const barY = -hh - 15

    this.damageGfx.clear()
    if (ratio >= 0.98 || !this.built) return

    const barColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444
    this.damageGfx.fillStyle(0x020617, 0.82)
    this.damageGfx.fillRoundedRect(-hw, barY, barWidth, 5, 3)
    this.damageGfx.fillStyle(barColor, 1)
    this.damageGfx.fillRoundedRect(-hw, barY, Math.max(3, Math.floor(barWidth * ratio)), 5, 3)

    const crackColor = ratio > 0.45 ? 0x7f1d1d : 0xfef2f2
    this.damageGfx.lineStyle(2, crackColor, ratio > 0.45 ? 0.55 : 0.9)
    this.damageGfx.beginPath()
    this.damageGfx.moveTo(-hw + config.width * 0.25, -hh + 7)
    this.damageGfx.lineTo(-hw + config.width * 0.38, -hh + config.height * 0.36)
    this.damageGfx.lineTo(-hw + config.width * 0.31, -hh + config.height * 0.62)
    this.damageGfx.strokePath()

    if (ratio <= 0.5) {
      this.damageGfx.lineStyle(2, crackColor, 0.85)
      this.damageGfx.beginPath()
      this.damageGfx.moveTo(hw - config.width * 0.22, -hh + 9)
      this.damageGfx.lineTo(hw - config.width * 0.42, -hh + config.height * 0.42)
      this.damageGfx.lineTo(hw - config.width * 0.28, hh - 8)
      this.damageGfx.strokePath()
    }
  }

  tick(delta: number): void {
    if (this.built) return

    const config = BUILDING_CONFIGS[this.buildingType]
    this.buildProgress += delta / 1000 / config.buildTime
    if (this.buildProgress >= 1) {
      this.buildProgress = 1
      this.built = true
      this.drawBody()
      this.progressGfx.clear()
    } else {
      this.drawProgressBar()
    }
  }

  setSelected(selected: boolean): void {
    const config = BUILDING_CONFIGS[this.buildingType]
    const { width, height } = config
    const hw = width / 2
    const hh = height / 2

    this.selectionGfx.clear()
    if (selected) {
      this.selectionGfx.lineStyle(2, 0xffffff, 1)
      this.selectionGfx.strokeRoundedRect(-hw - 3, -hh - 3, width + 6, height + 6, 5)
    }
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    this.drawDamageState()
    if (this.hp <= 0) {
      this.destroy()
      return true
    }
    return false
  }

  repair(amount: number): boolean {
    if (!this.active || !this.built || this.hp >= this.maxHp) return false
    this.hp = Math.min(this.maxHp, this.hp + amount)
    this.drawDamageState()
    this.repairFxTimer += amount
    if (this.repairFxTimer >= 6) {
      this.repairFxTimer = 0
      this.playRepairSpark()
    }
    if (this.hp >= this.maxHp) this.damageGfx.clear()
    return this.hp >= this.maxHp
  }

  private playRepairSpark(): void {
    const spark = this.scene.add.graphics()
    spark.setDepth(5)
    spark.lineStyle(2, 0xbbf7d0, 0.95)
    spark.lineBetween(-4, 0, 4, 0)
    spark.lineBetween(0, -4, 0, 4)
    spark.setPosition(this.x + Phaser.Math.Between(-12, 12), this.y + Phaser.Math.Between(-14, 8))
    this.scene.tweens.add({
      targets: spark,
      y: spark.y - 12,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => spark.destroy(),
    })
  }

  get damaged(): boolean {
    return this.hp < this.maxHp
  }

  drawProgressBar(): void {
    const config = BUILDING_CONFIGS[this.buildingType]
    const barWidth = config.width
    const barHeight = 5
    const hw = config.width / 2
    const hh = config.height / 2
    const barY = -hh - 9

    this.progressGfx.clear()

    // Background
    this.progressGfx.fillStyle(0x020617, 0.85)
    this.progressGfx.fillRoundedRect(-hw, barY, barWidth, barHeight, 3)

    // Fill
    this.progressGfx.fillStyle(0x22c55e, 1)
    this.progressGfx.fillRoundedRect(-hw, barY, Math.max(3, Math.floor(barWidth * this.buildProgress)), barHeight, 3)
  }
}
