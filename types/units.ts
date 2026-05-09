export type WorkerState = 'idle' | 'moving' | 'gathering' | 'returning' | 'building' | 'moving_to_build'
export type Faction = 'player' | 'ai'

export type GameSelection =
  | { type: 'none' }
  | { type: 'worker'; workerState: WorkerState }
  | { type: 'townhall'; training: { progress: number } | null }
  | { type: 'barracks'; built: boolean }
  | { type: 'farm'; built: boolean }
  | { type: 'mine'; built: boolean }
