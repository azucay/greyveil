export interface MinimapData {
  buildings: { wx: number; wy: number; faction: 'player' | 'ai' }[]
  soldiers:  { wx: number; wy: number; faction: 'player' | 'ai' }[]
  cameraX: number
  cameraY: number
  cameraW: number
  cameraH: number
  mapW: number
  mapH: number
}
