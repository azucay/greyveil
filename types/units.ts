import { TILE_SIZE } from '@/game/constants'
import type { ResourceCost } from './resources'

export type WorkerState = 'idle' | 'moving' | 'gathering' | 'returning' | 'building' | 'moving_to_build' | 'repairing' | 'moving_to_repair'
export type SoldierState = 'idle' | 'moving' | 'attacking' | 'dead'
export type SoldierType = 'swordsman' | 'archer'
export type TrainableUnitType = 'worker' | SoldierType
export type Faction = 'player' | 'ai'

export type BuildingSelectionStats = { built: boolean; hp: number; maxHp: number; damaged: boolean }

export type GameSelection =
  | { type: 'none' }
  | { type: 'worker'; workerState: WorkerState }
  | { type: 'soldier'; soldierType: SoldierType; hp: number; maxHp: number }
  | { type: 'army'; count: number; totalHp: number; maxTotalHp: number }
  | ({ type: 'townhall'; training: { progress: number } | null; queue: TrainableUnitType[] } & BuildingSelectionStats)
  | ({ type: 'barracks'; training: { soldierType: SoldierType; progress: number } | null; queue: TrainableUnitType[] } & BuildingSelectionStats)
  | ({ type: 'farm' } & BuildingSelectionStats)
  | ({ type: 'mine' } & BuildingSelectionStats)
  | ({ type: 'watchtower' } & BuildingSelectionStats)

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
  swordsman: { hp: 100, damage: 15, range: 1.5 * TILE_SIZE, speed: 82, trainTime: 14000, cost: { metal: 45, food: 25 }, radius: 10 },
  archer:    { hp: 70,  damage: 20, range: 5   * TILE_SIZE, speed: 74, trainTime: 12000, cost: { wood: 35, food: 15, metal: 20 }, radius: 10 },
}
