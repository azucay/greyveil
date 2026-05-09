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

    this.add(this.bodyGfx)
    this.add(this.selectionGfx)
    this.add(this.progressGfx)

    scene.add.existing(this)

    this.drawBody()
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
    this.bodyGfx.fillRect(-hw, -hh, width, height)

    // Border
    this.bodyGfx.lineStyle(2, 0xffffff, alpha * 0.5)
    this.bodyGfx.strokeRect(-hw, -hh, width, height)
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
      this.selectionGfx.strokeRect(-hw - 3, -hh - 3, width + 6, height + 6)
    }
  }

  drawProgressBar(): void {
    const config = BUILDING_CONFIGS[this.buildingType]
    const barWidth = config.width
    const barHeight = 4
    const hw = config.width / 2
    const hh = config.height / 2
    const barY = hh + 6

    this.progressGfx.clear()

    // Background
    this.progressGfx.fillStyle(0x000000, 0.7)
    this.progressGfx.fillRect(-hw, barY, barWidth, barHeight)

    // Fill
    this.progressGfx.fillStyle(0x22c55e, 1)
    this.progressGfx.fillRect(-hw, barY, Math.floor(barWidth * this.buildProgress), barHeight)
  }
}
