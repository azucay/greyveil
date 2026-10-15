import * as Phaser from 'phaser'
import { EventBus } from '@/game/EventBus'
import { Building } from '@/game/entities/buildings/Building'
import { ResourceSystem } from '@/game/systems/ResourceSystem'
import type { BuildingType } from '@/types/buildings'
import type { Faction } from '@/types/units'
import type { Resources } from '@/types/resources'

export class BuildingSystem {
  private scene: Phaser.Scene
  private resourceSystem: ResourceSystem
  buildings: Map<string, Building> = new Map()

  // Accumulators for passive production (float amounts)
  private farmAccum: number = 0
  private mineMetalAccum: number = 0
  private mineGoldAccum: number = 0

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
    let resourcesChanged = false

    for (const b of this.buildings.values()) {
      if (!b.built || b.faction !== 'player') continue

      if (b.buildingType === 'farm') {
        // +5 food/s
        this.farmAccum += (5 * delta) / 1000
        const wholeFood = Math.floor(this.farmAccum)
        if (wholeFood > 0) {
          this.farmAccum -= wholeFood
          this.resourceSystem.add('player', 'food', wholeFood)
          resourcesChanged = true
        }
      }

      if (b.buildingType === 'mine') {
        // +2 metal/s
        this.mineMetalAccum += (2 * delta) / 1000
        const wholeMetal = Math.floor(this.mineMetalAccum)
        if (wholeMetal > 0) {
          this.mineMetalAccum -= wholeMetal
          this.resourceSystem.add('player', 'metal', wholeMetal)
          resourcesChanged = true
        }

        // +0.5 gold/s
        this.mineGoldAccum += (0.5 * delta) / 1000
        const wholeGold = Math.floor(this.mineGoldAccum)
        if (wholeGold > 0) {
          this.mineGoldAccum -= wholeGold
          this.resourceSystem.add('player', 'gold', wholeGold)
          resourcesChanged = true
        }
      }
    }

    if (resourcesChanged) {
      EventBus.emit<Resources>('resources-updated', this.resourceSystem.getPlayerResources())
    }

    // Suppress unused variable warning
    void this.scene
  }
}
