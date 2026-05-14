import * as Phaser from 'phaser'
import { TILE_SIZE } from '@/game/constants'
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

  private bodyGfx: Phaser.GameObjects.Graphics
  private selectionGfx: Phaser.GameObjects.Graphics
  private progressGfx: Phaser.GameObjects.Graphics
  private damageGfx: Phaser.GameObjects.Graphics
  private labelBgGfx: Phaser.GameObjects.Graphics
  private labelText: Phaser.GameObjects.Text

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
    this.selectionGfx = scene.add.graphics()
    this.progressGfx = scene.add.graphics()
    this.damageGfx = scene.add.graphics()
    this.labelBgGfx = scene.add.graphics()

    const labelNames: Record<BuildingType, string> = {
      townhall: 'Rathaus', barracks: 'Kaserne', farm: 'Farm', mine: 'Mine',
    }
    const hh = config.height / 2
    this.labelText = scene.add.text(0, hh + 9, labelNames[buildingType], {
      fontSize: '12px', color: '#f8fafc', fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#020617', strokeThickness: 3,
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0)

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

    // Shadow
    this.bodyGfx.fillStyle(0x000000, 0.4)
    this.bodyGfx.fillRect(-hw + 3, -hh + 3, width, height)

    // Fill
    this.bodyGfx.fillStyle(color, alpha)
    this.bodyGfx.fillRoundedRect(-hw, -hh, width, height, 4)

    // Subtle faction header stripe
    this.bodyGfx.fillStyle(this.faction === 'player' ? 0x60a5fa : 0xfca5a5, alpha * 0.55)
    this.bodyGfx.fillRoundedRect(-hw + 3, -hh + 3, width - 6, 5, 3)

    // Border
    this.bodyGfx.lineStyle(2, this.faction === 'player' ? 0xbfdbfe : 0xfecaca, alpha * 0.7)
    this.bodyGfx.strokeRoundedRect(-hw, -hh, width, height, 4)

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
