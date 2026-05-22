import * as Phaser from 'phaser'
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PLAYER_START_TILE, AI_START_TILE } from '@/game/constants'
import { WAR2_ASSETS } from '@/game/assets/War2Assets'
import type { GameMap, Tile, TileType } from '@/types/map'

interface PathNode {
  x: number; y: number; g: number; h: number; f: number; parent: PathNode | null
}

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

  setWalkable(x: number, y: number, walkable: boolean): void {
    const tile = this.getTile(x, y)
    if (!tile) return
    tile.walkable = walkable
  }

  findPath(fromTileX: number, fromTileY: number, toTileX: number, toTileY: number): { worldX: number; worldY: number }[] {
    toTileX = Math.max(0, Math.min(MAP_WIDTH - 1, toTileX))
    toTileY = Math.max(0, Math.min(MAP_HEIGHT - 1, toTileY))
    fromTileX = Math.max(0, Math.min(MAP_WIDTH - 1, fromTileX))
    fromTileY = Math.max(0, Math.min(MAP_HEIGHT - 1, fromTileY))

    if (!this.isWalkable(toTileX, toTileY)) {
      const nearest = this.nearestWalkable(toTileX, toTileY)
      if (!nearest) return []
      toTileX = nearest.x; toTileY = nearest.y
    }

    const toWorld = (tx: number, ty: number) => ({ worldX: tx * TILE_SIZE + TILE_SIZE / 2, worldY: ty * TILE_SIZE + TILE_SIZE / 2 })
    if (fromTileX === toTileX && fromTileY === toTileY) return [toWorld(toTileX, toTileY)]

    const h = (x: number, y: number) => Math.abs(x - toTileX) + Math.abs(y - toTileY)
    const start: PathNode = { x: fromTileX, y: fromTileY, g: 0, h: h(fromTileX, fromTileY), f: h(fromTileX, fromTileY), parent: null }
    const openSet: PathNode[] = [start]
    const openMap = new Map<string, PathNode>([[ `${fromTileX},${fromTileY}`, start]])
    const closed = new Set<string>()
    const DIRS = [
      { dx: 0, dy: -1, c: 1 }, { dx: 0, dy: 1, c: 1 }, { dx: -1, dy: 0, c: 1 }, { dx: 1, dy: 0, c: 1 },
      { dx: -1, dy: -1, c: 1.414 }, { dx: 1, dy: -1, c: 1.414 }, { dx: -1, dy: 1, c: 1.414 }, { dx: 1, dy: 1, c: 1.414 },
    ]

    while (openSet.length > 0) {
      let bi = 0
      for (let i = 1; i < openSet.length; i++) if (openSet[i].f < openSet[bi].f) bi = i
      const cur = openSet.splice(bi, 1)[0]
      openMap.delete(`${cur.x},${cur.y}`)
      closed.add(`${cur.x},${cur.y}`)

      if (cur.x === toTileX && cur.y === toTileY) {
        const path: { worldX: number; worldY: number }[] = []
        let n: PathNode | null = cur
        while (n) { path.unshift(toWorld(n.x, n.y)); n = n.parent }
        return path
      }

      for (const { dx, dy, c } of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy, nk = `${nx},${ny}`
        if (closed.has(nk) || !this.isWalkable(nx, ny)) continue
        if (dx !== 0 && dy !== 0 && (!this.isWalkable(cur.x + dx, cur.y) || !this.isWalkable(cur.x, cur.y + dy))) continue
        const g = cur.g + c
        const ex = openMap.get(nk)
        if (ex && ex.g <= g) continue
        const nb: PathNode = { x: nx, y: ny, g, h: h(nx, ny), f: g + h(nx, ny), parent: cur }
        if (ex) { const i = openSet.indexOf(ex); if (i >= 0) openSet.splice(i, 1) }
        openSet.push(nb); openMap.set(nk, nb)
      }
    }
    return []
  }

  nearestWalkable(tileX: number, tileY: number): { x: number; y: number } | null {
    for (let r = 1; r <= 15; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          if (this.isWalkable(tileX + dx, tileY + dy)) return { x: tileX + dx, y: tileY + dy }
        }
      }
    }
    return null
  }

  render(scene: Phaser.Scene): void {
    const totalWidth = MAP_WIDTH * TILE_SIZE
    const totalHeight = MAP_HEIGHT * TILE_SIZE
    const rt = scene.add.renderTexture(0, 0, totalWidth, totalHeight)
    rt.setOrigin(0, 0)

    const terrainKeys: string[] = [WAR2_ASSETS.terrain.grass, WAR2_ASSETS.terrain.water, WAR2_ASSETS.terrain.mountain]
    const hasTerrainAssets = terrainKeys.every(key => scene.textures.exists(key))
    const stamp = hasTerrainAssets ? scene.add.image(0, 0, WAR2_ASSETS.terrain.grass).setOrigin(0, 0).setVisible(false) : null
    const gfx = scene.add.graphics()

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.map[y][x]
        const px = x * TILE_SIZE
        const py = y * TILE_SIZE
        const key = WAR2_ASSETS.terrain[tile.type]

        if (stamp && scene.textures.exists(key)) {
          stamp.setTexture(key)
          stamp.setPosition(px, py)
          rt.draw(stamp)
        } else {
          gfx.clear()
          gfx.fillStyle(TILE_BORDER_COLORS[tile.type])
          gfx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          gfx.fillStyle(TILE_COLORS[tile.type])
          gfx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
          rt.draw(gfx, 0, 0)
        }
      }
    }

    if (stamp) stamp.destroy()
    gfx.destroy()
    rt.setDepth(0)
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
