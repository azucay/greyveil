import { Soldier } from '@/game/entities/units/Soldier'
import { BuildingSystem } from '@/game/systems/BuildingSystem'
import type { Building } from '@/game/entities/buildings/Building'
import type { Faction } from '@/types/units'

export class CombatSystem {
  soldiers: Soldier[] = []

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
    for (const s of soldiers) {
      s.target = null
      s.setMoveTarget(worldX, worldY, () => { s.state = 'idle' })
    }
  }

  update(delta: number, buildingSystem: BuildingSystem): void {
    for (const soldier of this.soldiers) {
      if (soldier.state === 'dead') continue

      soldier.update(delta)

      if (soldier.state === 'attacking' || soldier.state === 'idle') {
        // Auto-find nearest enemy if no target or target is dead
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
                }
              }
            }
          } else {
            // Chase the target
            soldier.state = 'moving'
            const ratio = Math.min((soldier.speed * delta / 1000) / dist, 1)
            soldier.x += dx * ratio
            soldier.y += dy * ratio
          }
        } else {
          soldier.state = 'idle'
        }
      }
    }

    // Remove dead soldiers
    this.soldiers = this.soldiers.filter(s => s.state !== 'dead')
  }

  private findNearestEnemy(soldier: Soldier): Soldier | null {
    let best: Soldier | null = null
    let bestDist = Infinity
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
    let bestDist = Infinity
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
