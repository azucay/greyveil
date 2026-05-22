import * as Phaser from 'phaser'
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PLAYER_START_TILE, AI_START_TILE } from '@/game/constants'
import { EventBus } from '@/game/EventBus'
import { WAR2_ASSETS } from '@/game/assets/War2Assets'
import type { Resources, ResourceType, ResourceCost, ResourceNode } from '@/types/resources'
import type { GameMap } from '@/types/map'
import type { MapSystem } from '@/game/systems/MapSystem'

const STARTING_RESOURCES: Resources = {
  wood: 240,
  stone: 170,
  food: 90,
  metal: 0,
  gold: 0,
}

const NODE_CONFIG: Record<Exclude<ResourceType, 'food'>, { color: number; amount: number; count: number }> = {
  wood: { color: 0x2f855a, amount: 180, count: 0 },
  stone: { color: 0x9ca3af, amount: 320, count: 6 },
  metal: { color: 0xcbd5e1, amount: 220, count: 4 },
  gold: { color: 0xfcd34d, amount: 170, count: 3 },
}

const NODE_SIZE = 22
const MIN_DIST_FROM_START = 6
const FOREST_CLUSTER_COUNT = 4
const FOREST_TILES_PER_CLUSTER = 20

export class ResourceSystem {
  private playerResources: Resources
  private aiResources: Resources
  nodes: ResourceNode[] = []
  private nodeObjects: Map<string, Phaser.GameObjects.Graphics> = new Map()
  private nodeSprites: Map<string, Phaser.GameObjects.Image[]> = new Map()
  private scene: Phaser.Scene | null = null
  private mapSystem: MapSystem | null = null

  constructor() {
    this.playerResources = { ...STARTING_RESOURCES }
    this.aiResources = { ...STARTING_RESOURCES }
  }

  getPlayerResources(): Resources {
    return { ...this.playerResources }
  }

  add(faction: 'player' | 'ai', type: ResourceType, amount: number): void {
    const res = faction === 'player' ? this.playerResources : this.aiResources
    res[type] += amount
    if (faction === 'player') EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
  }

  subtract(faction: 'player' | 'ai', type: ResourceType, amount: number): void {
    const res = faction === 'player' ? this.playerResources : this.aiResources
    res[type] = Math.max(0, res[type] - amount)
    if (faction === 'player') EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
  }

  canAfford(faction: 'player' | 'ai', cost: ResourceCost): boolean {
    const res = faction === 'player' ? this.playerResources : this.aiResources
    return (Object.entries(cost) as [ResourceType, number][]).every(([type, amount]) => res[type] >= amount)
  }

  placeNodes(scene: Phaser.Scene, map: GameMap, mapSystem?: MapSystem): void {
    this.scene = scene
    this.mapSystem = mapSystem ?? null
    const usedTiles = new Set<string>()

    const isValid = (tx: number, ty: number): boolean => {
      if (!map[ty]?.[tx]?.walkable) return false
      if (usedTiles.has(`${tx},${ty}`)) return false
      const dp = Math.abs(tx - PLAYER_START_TILE.x) + Math.abs(ty - PLAYER_START_TILE.y)
      const da = Math.abs(tx - AI_START_TILE.x) + Math.abs(ty - AI_START_TILE.y)
      return dp >= MIN_DIST_FROM_START && da >= MIN_DIST_FROM_START
    }

    this.placeForestClusters(scene, map, usedTiles, isValid)

    const nodeTypes = ['stone', 'metal', 'gold'] as Exclude<ResourceType, 'food' | 'wood'>[]
    for (const type of nodeTypes) {
      const { amount, count } = NODE_CONFIG[type]
      let placed = 0
      let attempts = 0

      while (placed < count && attempts < 1000) {
        attempts++
        const tx = Math.floor(Math.random() * MAP_WIDTH)
        const ty = Math.floor(Math.random() * MAP_HEIGHT)
        if (!isValid(tx, ty)) continue
        this.createNode(scene, type, amount, tx, ty, `${type}-${placed}`)
        usedTiles.add(`${tx},${ty}`)
        placed++
      }
    }

    EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
  }

  private placeForestClusters(
    scene: Phaser.Scene,
    map: GameMap,
    usedTiles: Set<string>,
    isValid: (tx: number, ty: number) => boolean
  ): void {
    let forests = 0
    let attempts = 0
    while (forests < FOREST_CLUSTER_COUNT && attempts < 300) {
      attempts++
      const seedX = Math.floor(4 + Math.random() * (MAP_WIDTH - 8))
      const seedY = Math.floor(4 + Math.random() * (MAP_HEIGHT - 8))
      if (!isValid(seedX, seedY)) continue

      const cluster: { x: number; y: number }[] = [{ x: seedX, y: seedY }]
      const frontier: { x: number; y: number }[] = [{ x: seedX, y: seedY }]
      const local = new Set<string>([`${seedX},${seedY}`])

      while (cluster.length < FOREST_TILES_PER_CLUSTER && frontier.length > 0) {
        const cur = frontier[Math.floor(Math.random() * frontier.length)]
        const dirs = Phaser.Utils.Array.Shuffle([
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
        ])
        let expanded = false
        for (const { dx, dy } of dirs) {
          const tx = cur.x + dx
          const ty = cur.y + dy
          const key = `${tx},${ty}`
          if (local.has(key) || !isValid(tx, ty)) continue
          local.add(key)
          cluster.push({ x: tx, y: ty })
          frontier.push({ x: tx, y: ty })
          expanded = true
          break
        }
        if (!expanded) frontier.splice(frontier.indexOf(cur), 1)
      }

      if (cluster.length < 14) continue

      for (const tile of cluster) this.mapSystem?.setWalkable(tile.x, tile.y, false)
      const stillConnected = !this.mapSystem || this.mapSystem.findPath(
        PLAYER_START_TILE.x, PLAYER_START_TILE.y, AI_START_TILE.x, AI_START_TILE.y
      ).length > 0
      if (!stillConnected) {
        for (const tile of cluster) this.mapSystem?.setWalkable(tile.x, tile.y, true)
        continue
      }

      cluster.forEach((tile, index) => {
        const id = `wood-${forests}-${index}`
        this.createNode(scene, 'wood', NODE_CONFIG.wood.amount, tile.x, tile.y, id)
        usedTiles.add(`${tile.x},${tile.y}`)
      })
      forests++
    }
  }

  private createNode(scene: Phaser.Scene, type: Exclude<ResourceType, 'food'>, amount: number, tx: number, ty: number, id: string): void {
    const node: ResourceNode = { id, type, amount, tileX: tx, tileY: ty, depleted: false }
    this.nodes.push(node)
    const gfx = scene.add.graphics()
    gfx.setDepth(type === 'wood' ? 1.2 : 0.8)
    this.nodeObjects.set(node.id, gfx)
    this.redrawNode(node)
  }

  redrawNode(node: ResourceNode): void {
    const gfx = this.nodeObjects.get(node.id)
    if (!gfx) return

    const cfg = NODE_CONFIG[node.type as Exclude<ResourceType, 'food'>]
    const px = node.tileX * TILE_SIZE + TILE_SIZE / 2
    const py = node.tileY * TILE_SIZE + TILE_SIZE / 2
    const ratio = Math.max(0, Math.min(1, node.amount / cfg.amount))

    gfx.clear()

    if (node.type === 'wood') {
      const trees = Math.max(1, Math.ceil(4 * ratio))
      const offsets = [
        { x: -7, y: 3, s: 0.74 }, { x: 1, y: -6, s: 0.88 }, { x: 8, y: 5, s: 0.68 }, { x: -1, y: 8, s: 0.62 },
      ]
      const existingSprites = this.nodeSprites.get(node.id) ?? []
      for (const sprite of existingSprites) sprite.destroy()
      this.nodeSprites.delete(node.id)

      gfx.fillStyle(0x052e16, 0.36)
      gfx.fillEllipse(px, py + 8, 31, 17)

      if (this.scene && this.scene.textures.exists(WAR2_ASSETS.resources.tree)) {
        const sprites: Phaser.GameObjects.Image[] = []
        for (let i = 0; i < trees; i++) {
          const o = offsets[i]
          const sprite = this.scene.add.image(px + o.x, py + o.y + 8, WAR2_ASSETS.resources.tree)
            .setOrigin(0.5, 0.82)
            .setScale(o.s)
            .setDepth(1.15 + (py + o.y) / 100000)
          sprites.push(sprite)
        }
        this.nodeSprites.set(node.id, sprites)
      } else {
        for (let i = 0; i < trees; i++) {
          const o = offsets[i]
          gfx.fillStyle(0x7c2d12, 1)
          gfx.fillRoundedRect(px + o.x - 2, py + o.y + 4, 4, 7 * o.s, 1)
          gfx.fillStyle(i % 2 === 0 ? 0x14532d : 0x166534, 1)
          gfx.fillTriangle(px + o.x, py + o.y - 13 * o.s, px + o.x - 10 * o.s, py + o.y + 6 * o.s, px + o.x + 10 * o.s, py + o.y + 6 * o.s)
          gfx.fillStyle(0x22c55e, 0.58)
          gfx.fillTriangle(px + o.x, py + o.y - 9 * o.s, px + o.x - 5 * o.s, py + o.y + 1 * o.s, px + o.x + 5 * o.s, py + o.y + 1 * o.s)
        }
      }
      gfx.lineStyle(1, 0xbbf7d0, 0.18 + ratio * 0.24)
      gfx.strokeRect(px - TILE_SIZE / 2 + 1, py - TILE_SIZE / 2 + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      return
    }

    const color = cfg.color
    gfx.fillStyle(0x000000, 0.34)
    gfx.fillEllipse(px + 2, py + 7, NODE_SIZE + 8, 10)
    if (node.type === 'stone') {
      gfx.fillStyle(0x6b7280, 1)
      gfx.fillTriangle(px - 12, py + 9, px - 4, py - 10, px + 4, py + 9)
      gfx.fillStyle(0x9ca3af, 1)
      gfx.fillTriangle(px - 2, py + 9, px + 8, py - 8, px + 14, py + 9)
    } else {
      gfx.fillStyle(color, 1)
      gfx.fillCircle(px, py, 9)
      gfx.fillStyle(node.type === 'gold' ? 0xfef3c7 : 0xf8fafc, 0.8)
      gfx.fillCircle(px - 3, py - 3, 3)
    }
    gfx.lineStyle(1, 0xffffff, 0.38)
    gfx.strokeCircle(px, py, 11)
  }

  depleteNode(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.depleted = true
    if (node.type === 'wood') {
      this.mapSystem?.setWalkable(node.tileX, node.tileY, true)
      for (const sprite of this.nodeSprites.get(nodeId) ?? []) sprite.destroy()
      this.nodeSprites.delete(nodeId)
    }
    const gfx = this.nodeObjects.get(nodeId)
    if (gfx) {
      gfx.destroy()
      this.nodeObjects.delete(nodeId)
    }
  }
}
