export type ResourceType = 'wood' | 'stone' | 'food' | 'metal' | 'gold'

export interface Resources {
  wood: number
  stone: number
  food: number
  metal: number
  gold: number
}

export type ResourceCost = Partial<Resources>

export interface ResourceNode {
  id: string
  type: ResourceType
  amount: number
  tileX: number
  tileY: number
  depleted: boolean
}
