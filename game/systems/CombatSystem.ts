import { EventBus } from '@/game/EventBus'
import { Soldier } from '@/game/entities/units/Soldier'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import { MapSystem } from '@/game/systems/MapSystem'
import { TILE_SIZE } from '@/game/constants'
import type { Building } from '@/game/entities/buildings/Building'
import type { Faction } from '@/types/units'

export class CombatSystem {
  soldiers: Soldier[] = []
  private mapSystem: MapSystem

  constructor(mapSystem: MapSystem) {
    this.mapSystem = mapSystem
  }

  addSoldier(soldier: Soldier): void {
    this.soldiers.push(soldier)
  }

  getSoldierAt(worldX: number, worldY: number): Soldier | null {
    for (const s of this.soldiers) {
      if (s.state === 'dead') continue
      const dx = s.x - worldX
      const dy = s.y - worldY
      if (Math.sqrt(dx * dx + dy * dy) <= 14) return s
    }
    return null
  }

  commandAttack(soldiers: Soldier[], target: Soldier | Building): void {
    for (const s of soldiers) {
      s.target = target
      s.state = 'attacking'
      s.attackTimer = 0
    }
  }

  commandMoveSoldiers(soldiers: Soldier[], worldX: number, worldY: number): void {
    const toTX = Math.floor(worldX / TILE_SIZE)
    const toTY = Math.floor(worldY / TILE_SIZE)
    for (const s of soldiers) {
      s.target = null
      const fromTX = Math.floor(s.x / TILE_SIZE)
      const fromTY = Math.floor(s.y / TILE_SIZE)
      const path = this.mapSystem.findPath(fromTX, fromTY, toTX, toTY)
      if (path.length > 0) {
        s.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })), () => { s.state = 'idle' })
      }
    }
  }

  // T18: push overlapping soldiers apart
  private readonly SEPARATION_DIST = 18
  private readonly SEPARATION_STRENGTH = 30

  private applySeparation(delta: number): void {
    const dt = delta / 1000
    const living = this.soldiers.filter(s => s.state !== 'dead')
    for (let i = 0; i < living.length; i++) {
      const a = living[i]
      let fx = 0, fy = 0
      for (let j = 0; j < living.length; j++) {
        if (i === j) continue
        const b = living[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const distSq = dx * dx + dy * dy
        if (distSq > 0 && distSq < this.SEPARATION_DIST * this.SEPARATION_DIST) {
          const dist = Math.sqrt(distSq)
          const strength = this.SEPARATION_STRENGTH * (1 - dist / this.SEPARATION_DIST)
          fx += (dx / dist) * strength
          fy += (dy / dist) * strength
        }
      }
      a.x += fx * dt
      a.y += fy * dt
    }
  }

  update(delta: number, buildingSystem: BuildingSystem): void {
    this.applySeparation(delta)

    for (const soldier of this.soldiers) {
      if (soldier.state === 'dead') continue

      soldier.update(delta)

      if (soldier.state === 'attacking' || soldier.state === 'idle') {
        if (!soldier.target || (soldier.target instanceof Soldier && soldier.target.state === 'dead')) {
          soldier.target = this.findNearestEnemy(soldier) ?? this.findNearestEnemyBuilding(soldier, buildingSystem)
        }

        if (soldier.target) {
          const tx = (soldier.target as Soldier).x ?? (soldier.target as Building).x
          const ty = (soldier.target as Soldier).y ?? (soldier.target as Building).y
          const dx = tx - soldier.x
          const dy = ty - soldier.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist <= soldier.attackRange) {
            soldier.state = 'attacking'
            soldier.attackTimer += delta
            if (soldier.attackTimer >= 1000) {
              soldier.attackTimer = 0
              if (soldier.target instanceof Soldier) {
                const died = soldier.target.takeDamage(soldier.damage)
                if (died) soldier.target = null
              } else {
                const building = soldier.target as Building
                const died = building.takeDamage(soldier.damage)
                if (died) {
                  buildingSystem.removeBuilding(building)
                  soldier.target = null
                  if (building.buildingType === 'townhall') {
                    EventBus.emit<'victory' | 'defeat'>(
                      'game-over',
                      building.faction === 'player' ? 'defeat' : 'victory'
                    )
                  }
                }
              }
            }
          } else {
            // Chase with A* so soldiers don't walk through water/mountains
            const targetTX = Math.floor(tx / TILE_SIZE)
            const targetTY = Math.floor(ty / TILE_SIZE)
            const fromTX = Math.floor(soldier.x / TILE_SIZE)
            const fromTY = Math.floor(soldier.y / TILE_SIZE)
            const path = this.mapSystem.findPath(fromTX, fromTY, targetTX, targetTY)
            if (path.length > 0) {
              soldier.setPath(path.map(p => ({ x: p.worldX, y: p.worldY })))
            } else {
              soldier.setMoveTarget(tx, ty)
            }
          }
        } else {
          soldier.state = 'idle'
        }
      }
    }

    this.soldiers = this.soldiers.filter(s => s.state !== 'dead')
  }

  // Soldiers only auto-aggro enemies within this radius; commandAttack() bypasses this limit
  private readonly AGGRO_RANGE = 5 * TILE_SIZE

  private findNearestEnemy(soldier: Soldier): Soldier | null {
    let best: Soldier | null = null
    let bestDist = this.AGGRO_RANGE * this.AGGRO_RANGE
    for (const other of this.soldiers) {
      if (other.faction === soldier.faction || other.state === 'dead') continue
      const dx = other.x - soldier.x
      const dy = other.y - soldier.y
      const d = dx * dx + dy * dy
      if (d < bestDist) { bestDist = d; best = other }
    }
    return best
  }

  private findNearestEnemyBuilding(soldier: Soldier, buildingSystem: BuildingSystem): Building | null {
    const enemyFaction: Faction = soldier.faction === 'player' ? 'ai' : 'player'
    let best: Building | null = null
    let bestDist = this.AGGRO_RANGE * this.AGGRO_RANGE
    for (const b of buildingSystem.buildings.values()) {
      if (b.faction !== enemyFaction) continue
      const dx = b.x - soldier.x
      const dy = b.y - soldier.y
      const d = dx * dx + dy * dy
      if (d < bestDist) { bestDist = d; best = b }
    }
    return best
  }

  getSoldiersOfFaction(faction: Faction): Soldier[] {
    return this.soldiers.filter(s => s.faction === faction && s.state !== 'dead')
  }
}
