import { TILE_SIZE } from '@/game/constants'
import type { ResourceCost } from './resources'

export type WorkerState = 'idle' | 'moving' | 'gathering' | 'returning' | 'building' | 'moving_to_build'
export type SoldierState = 'idle' | 'moving' | 'attacking' | 'dead'
export type SoldierType = 'swordsman' | 'archer'
export type Faction = 'player' | 'ai'

export type GameSelection =
  | { type: 'none' }
  | { type: 'worker'; workerState: WorkerState }
  | { type: 'soldier'; soldierType: SoldierType; hp: number; maxHp: number }
  | { type: 'army'; count: number; totalHp: number; maxTotalHp: number }
  | { type: 'townhall'; training: { progress: number } | null }
  | { type: 'barracks'; built: boolean; training: { soldierType: SoldierType; progress: number } | null }
  | { type: 'farm'; built: boolean }
  | { type: 'mine'; built: boolean }
  | { type: 'watchtower'; built: boolean }

export interface SoldierConfig {
  hp: number
  damage: number
  range: number
  speed: number
  trainTime: number
  cost: ResourceCost
  radius: number
}

export const SOLDIER_CONFIGS: Record<SoldierType, SoldierConfig> = {
  swordsman: { hp: 100, damage: 15, range: 1.5 * TILE_SIZE, speed: 80, trainTime: 15000, cost: { metal: 50, food: 20 }, radius: 10 },
  archer:    { hp: 70,  damage: 20, range: 5   * TILE_SIZE, speed: 70, trainTime: 12000, cost: { wood: 30, metal: 30  }, radius: 10 },
}
