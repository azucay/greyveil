import * as Phaser from 'phaser'
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PLAYER_START_TILE, AI_START_TILE } from '@/game/constants'
import { EventBus } from '@/game/EventBus'
import type { Resources, ResourceType, ResourceCost, ResourceNode } from '@/types/resources'
import type { GameMap } from '@/types/map'

const STARTING_RESOURCES: Resources = {
  wood: 200,
  stone: 150,
  food: 50,
  metal: 0,
  gold: 0,
}

const NODE_CONFIG: Record<Exclude<ResourceType, 'food'>, { color: number; amount: number; count: number }> = {
  wood: { color: 0x4ade80, amount: 500, count: 8 },
  stone: { color: 0x9ca3af, amount: 300, count: 6 },
  metal: { color: 0xcbd5e1, amount: 200, count: 4 },
  gold: { color: 0xfcd34d, amount: 150, count: 3 },
}

const NODE_SIZE = 20
const MIN_DIST_FROM_START = 6

export class ResourceSystem {
  private playerResources: Resources
  private aiResources: Resources
  nodes: ResourceNode[] = []
  private nodeObjects: Map<string, Phaser.GameObjects.Graphics> = new Map()

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
    if (faction === 'player') {
      EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
    }
  }

  subtract(faction: 'player' | 'ai', type: ResourceType, amount: number): void {
    const res = faction === 'player' ? this.playerResources : this.aiResources
    res[type] = Math.max(0, res[type] - amount)
    if (faction === 'player') {
      EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
    }
  }

  canAfford(faction: 'player' | 'ai', cost: ResourceCost): boolean {
    const res = faction === 'player' ? this.playerResources : this.aiResources
    return (Object.entries(cost) as [ResourceType, number][]).every(
      ([type, amount]) => res[type] >= amount
    )
  }

  placeNodes(scene: Phaser.Scene, map: GameMap): void {
    const usedTiles = new Set<string>()

    const isValid = (tx: number, ty: number): boolean => {
      if (!map[ty]?.[tx]?.walkable) return false
      if (usedTiles.has(`${tx},${ty}`)) return false
      const dp = Math.abs(tx - PLAYER_START_TILE.x) + Math.abs(ty - PLAYER_START_TILE.y)
      const da = Math.abs(tx - AI_START_TILE.x) + Math.abs(ty - AI_START_TILE.y)
      return dp >= MIN_DIST_FROM_START && da >= MIN_DIST_FROM_START
    }

    const nodeTypes = Object.keys(NODE_CONFIG) as Exclude<ResourceType, 'food'>[]

    for (const type of nodeTypes) {
      const { color, amount, count } = NODE_CONFIG[type]
      let placed = 0
      let attempts = 0

      while (placed < count && attempts < 1000) {
        attempts++
        const tx = Math.floor(Math.random() * MAP_WIDTH)
        const ty = Math.floor(Math.random() * MAP_HEIGHT)

        if (!isValid(tx, ty)) continue

        const node: ResourceNode = {
          id: `${type}-${placed}`,
          type,
          amount,
          tileX: tx,
          tileY: ty,
          depleted: false,
        }
        this.nodes.push(node)
        usedTiles.add(`${tx},${ty}`)

        const gfx = scene.add.graphics()
        const px = tx * TILE_SIZE + (TILE_SIZE - NODE_SIZE) / 2
        const py = ty * TILE_SIZE + (TILE_SIZE - NODE_SIZE) / 2
        gfx.fillStyle(0x000000, 0.4)
        gfx.fillRect(px + 2, py + 2, NODE_SIZE, NODE_SIZE)
        gfx.fillStyle(color)
        gfx.fillRect(px, py, NODE_SIZE, NODE_SIZE)
        gfx.lineStyle(1, 0xffffff, 0.3)
        gfx.strokeRect(px, py, NODE_SIZE, NODE_SIZE)

        this.nodeObjects.set(node.id, gfx)
        placed++
      }
    }

    EventBus.emit<Resources>('resources-updated', this.getPlayerResources())
  }

  depleteNode(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return
    node.depleted = true
    const gfx = this.nodeObjects.get(nodeId)
    if (gfx) {
      gfx.destroy()
      this.nodeObjects.delete(nodeId)
    }
  }
}
