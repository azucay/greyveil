import type { ResourceCost } from './resources'

export type BuildingType = 'townhall' | 'barracks' | 'farm' | 'mine' | 'watchtower'

export interface BuildingConfig {
  type: BuildingType
  width: number
  height: number
  color: number
  hp: number
  buildTime: number
  cost: ResourceCost
  attackRange?: number
  attackDamage?: number
  attackCooldown?: number
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingConfig> = {
  townhall: { type: 'townhall', width: 48, height: 48, color: 0x374151, hp: 500, buildTime: 0, cost: {} },
  barracks: { type: 'barracks', width: 40, height: 40, color: 0x92400e, hp: 300, buildTime: 20, cost: { wood: 100, stone: 80 } },
  farm: { type: 'farm', width: 36, height: 36, color: 0x166534, hp: 200, buildTime: 15, cost: { wood: 60 } },
  mine: { type: 'mine', width: 40, height: 40, color: 0x451a03, hp: 250, buildTime: 20, cost: { wood: 80, stone: 60 } },
  watchtower: {
    type: 'watchtower', width: 34, height: 52, color: 0x78350f, hp: 260, buildTime: 18,
    cost: { wood: 120, stone: 80 }, attackRange: 5.5 * 32, attackDamage: 18, attackCooldown: 1200,
  },
}
