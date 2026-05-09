import * as Phaser from 'phaser'
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PLAYER_START_TILE, AI_START_TILE } from '@/game/constants'
import type { GameMap, Tile, TileType } from '@/types/map'

const TILE_COLORS: Record<TileType, number> = {
  grass: 0x86efac,
  water: 0x60a5fa,
  mountain: 0x6b7280,
}

const TILE_BORDER_COLORS: Record<TileType, number> = {
  grass: 0x4ade80,
  water: 0x3b82f6,
  mountain: 0x4b5563,
}

export class MapSystem {
  private map: GameMap

  constructor() {
    this.map = this.generateMap()
  }

  getMap(): GameMap {
    return this.map
  }

  getTile(x: number, y: number): Tile | null {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return null
    return this.map[y][x]
  }

  isWalkable(x: number, y: number): boolean {
    return this.getTile(x, y)?.walkable ?? false
  }

  render(scene: Phaser.Scene): void {
    const totalWidth = MAP_WIDTH * TILE_SIZE
    const totalHeight = MAP_HEIGHT * TILE_SIZE

    const gfx = scene.add.graphics()

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.map[y][x]
        const px = x * TILE_SIZE
        const py = y * TILE_SIZE

        gfx.fillStyle(TILE_BORDER_COLORS[tile.type])
        gfx.fillRect(px, py, TILE_SIZE, TILE_SIZE)

        gfx.fillStyle(TILE_COLORS[tile.type])
        gfx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      }
    }

    const rt = scene.add.renderTexture(0, 0, totalWidth, totalHeight)
    rt.setOrigin(0, 0)
    rt.draw(gfx, 0, 0)
    gfx.destroy()
  }

  private generateMap(): GameMap {
    const map: GameMap = Array.from({ length: MAP_HEIGHT }, (_, y) =>
      Array.from({ length: MAP_WIDTH }, (_, x) => ({
        type: 'grass' as TileType,
        walkable: true,
        x,
        y,
      }))
    )

    this.addClusters(map, 'water', 5, 4)
    this.addClusters(map, 'mountain', 6, 3)

    // Ensure start areas are always walkable grass
    this.clearArea(map, PLAYER_START_TILE.x, PLAYER_START_TILE.y, 7)
    this.clearArea(map, AI_START_TILE.x, AI_START_TILE.y, 7)

    return map
  }

  private addClusters(map: GameMap, type: TileType, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      // Avoid start corners
      const cx = Math.floor(4 + Math.random() * (MAP_WIDTH - 8))
      const cy = Math.floor(4 + Math.random() * (MAP_HEIGHT - 8))

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const tx = cx + dx
            const ty = cy + dy
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
              map[ty][tx] = { type, walkable: false, x: tx, y: ty }
            }
          }
        }
      }
    }
  }

  private clearArea(map: GameMap, cx: number, cy: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = cx + dx
        const ty = cy + dy
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          map[ty][tx] = { type: 'grass', walkable: true, x: tx, y: ty }
        }
      }
    }
  }
}
