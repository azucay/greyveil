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

export const RESOURCE_SYMBOLS: Record<ResourceType, string> = {
  wood: '🪵',
  stone: '🪨',
  food: '🌾',
  metal: '⚙️',
  gold: '🪙',
}

export function formatResourceCost(cost: ResourceCost): string {
  return (Object.entries(cost) as [ResourceType, number | undefined][])
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([type, amount]) => `${RESOURCE_SYMBOLS[type]}${amount}`)
    .join(' ')
}
