import * as Phaser from 'phaser'
import { EventBus } from '@/game/EventBus'
import { Building } from '@/game/entities/buildings/Building'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import type { BuildingType } from '@/types/buildings'
import type { Faction } from '@/types/units'
import type { Resources } from '@/types/resources'

type ProductionAccum = {
  farm: number
  mineMetal: number
}

export class BuildingSystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  buildings: Map<string, Building> = new Map()

  // Accumulators for passive production (float amounts), separated by faction.
  private productionAccum: Record<Faction, ProductionAccum> = {
    player: { farm: 0, mineMetal: 0 },
    ai: { farm: 0, mineMetal: 0 },
  }

  constructor(scene: Phaser.Scene, resourceSystem: ResourceSystem) {
    this.scene = scene
    this.resourceSystem = resourceSystem
  }

  addBuilding(b: Building, tileX: number, tileY: number): void {
    this.buildings.set(`${tileX},${tileY}`, b)
  }

  getBuildingAt(tileX: number, tileY: number): Building | null {
    return this.buildings.get(`${tileX},${tileY}`) ?? null
  }

  isTileOccupied(tileX: number, tileY: number): boolean {
    return this.buildings.has(`${tileX},${tileY}`)
  }

  removeBuilding(b: Building): void {
    this.buildings.delete(`${b.tileX},${b.tileY}`)
  }

  hasBuilding(b: Building): boolean {
    return this.buildings.get(`${b.tileX},${b.tileY}`) === b
  }

  getTownHall(faction: Faction): Building | null {
    for (const b of this.buildings.values()) {
      if (b.buildingType === 'townhall' && b.faction === faction) {
        return b
      }
    }
    return null
  }

  getBuiltCount(type: BuildingType, faction: Faction): number {
    let count = 0
    for (const b of this.buildings.values()) {
      if (b.buildingType === type && b.faction === faction && b.built) {
        count++
      }
    }
    return count
  }

  update(delta: number): void {
    let playerResourcesChanged = false

    for (const b of this.buildings.values()) {
      if (!b.built) continue
      const accum = this.productionAccum[b.faction]

      if (b.buildingType === 'farm') {
        // +5 food/s
        accum.farm += (5 * delta) / 1000
        const wholeFood = Math.floor(accum.farm)
        if (wholeFood > 0) {
          accum.farm -= wholeFood
          this.resourceSystem.add(b.faction, 'food', wholeFood)
          if (b.faction === 'player') playerResourcesChanged = true
        }
      }

      if (b.buildingType === 'mine') {
        // +2 metal/s; gold only comes from worker gathering gold nodes.
        accum.mineMetal += (2 * delta) / 1000
        const wholeMetal = Math.floor(accum.mineMetal)
        if (wholeMetal > 0) {
          accum.mineMetal -= wholeMetal
          this.resourceSystem.add(b.faction, 'metal', wholeMetal)
          if (b.faction === 'player') playerResourcesChanged = true
        }
      }
    }

    if (playerResourcesChanged) {
      EventBus.emit<Resources>('resources-updated', this.resourceSystem.getPlayerResources())
    }

    // Suppress unused variable warning
    void this.scene
  }
}
