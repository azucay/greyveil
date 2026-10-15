export type TileType = 'grass' | 'water' | 'mountain'

export interface Tile {
  type: TileType
  walkable: boolean
  x: number
  y: number
}

export type GameMap = Tile[][]
