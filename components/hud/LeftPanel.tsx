'use client'

import { useState, useEffect } from 'react'
import { EventBus } from '@/game/EventBus'
import { BUILDING_CONFIGS } from '@/types/buildings'
import { SOLDIER_CONFIGS } from '@/types/units'
import type { GameSelection, SoldierType } from '@/types/units'
import type { BuildingType } from '@/types/buildings'
import type { Resources } from '@/types/resources'
import { formatResourceCost, RESOURCE_SYMBOLS } from '@/types/resources'

interface Props {
  resources: Resources
}

const UNIT_ICONS: Record<string, string> = {
  worker: '👷', swordsman: '⚔️', archer: '🏹',
  townhall: '🏰', barracks: '🛡️', farm: '🌾', mine: '⛏️', watchtower: '🗼',
}

const UNIT_NAMES: Record<string, string> = {
  worker: 'Arbeiter', swordsman: 'Schwertmann', archer: 'Bogenschütze',
  townhall: 'Rathaus', barracks: 'Kaserne', farm: 'Farm', mine: 'Mine', watchtower: 'Wachturm',
}

const WORKER_STATE_DE: Record<string, string> = {
  idle: 'Wartet', moving: 'Läuft', gathering: 'Sammelt',
  returning: 'Kehrt zurück', building: 'Baut', moving_to_build: 'Zum Bau',
}

const BUILD_BUTTONS: { type: BuildingType; icon: string }[] = [
  { type: 'farm',     icon: '🌾' },
  { type: 'mine',     icon: '⛏️' },
  { type: 'barracks', icon: '🛡️' },
  { type: 'watchtower', icon: '🗼' },
]

type BuildPreviewState = { type: BuildingType; ready: boolean; valid: boolean } | null

export default function LeftPanel({ resources }: Props) {
  const [selection, setSelection] = useState<GameSelection>({ type: 'none' })
  const [buildMode, setBuildMode] = useState<BuildingType | null>(null)
  const [buildPreview, setBuildPreview] = useState<BuildPreviewState>(null)
  const [training, setTraining]   = useState<{ progress: number } | null>(null)

  useEffect(() => {
    const onSel   = (s: GameSelection)               => setSelection(s)
    const onBuild = (m: BuildingType | null)          => setBuildMode(m)
    const onPreview = (p: BuildPreviewState)          => setBuildPreview(p)
    const onTrain = (t: { progress: number } | null) => setTraining(t)

    EventBus.on<GameSelection>('selection-changed', onSel)
    EventBus.on<BuildingType | null>('build-mode-changed', onBuild)
    EventBus.on<BuildPreviewState>('build-preview-changed', onPreview)
    EventBus.on<{ progress: number } | null>('training-update', onTrain)

    return () => {
      EventBus.off<GameSelection>('selection-changed', onSel)
      EventBus.off<BuildingType | null>('build-mode-changed', onBuild)
      EventBus.off<BuildPreviewState>('build-preview-changed', onPreview)
      EventBus.off<{ progress: number } | null>('training-update', onTrain)
    }
  }, [])

  const canAffordBuilding = (type: BuildingType): boolean => {
    const cost = BUILDING_CONFIGS[type].cost
    return Object.entries(cost).every(([k, v]) => resources[k as keyof Resources] >= (v ?? 0))
  }

  const btn = (affordable = true): React.CSSProperties => ({
    padding: '5px 6px',
    borderRadius: '4px',
    border: `1px solid ${affordable ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    background: 'rgba(255,255,255,0.06)',
    color: affordable ? '#e5e7eb' : '#4b5563',
    cursor: affordable ? 'pointer' : 'not-allowed',
    fontSize: '11px',
    fontFamily: 'monospace',
    touchAction: 'manipulation',
    width: '100%',
    textAlign: 'left' as const,
  })

  const progressBar = (progress: number, color = '#22c55e') => (
    <div style={{ height: '5px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', margin: '3px 0' }}>
      <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: color, borderRadius: '3px', transition: 'width 0.1s linear' }} />
    </div>
  )

  const statRow = (label: string, value: string | number) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
      <span>{label}</span>
      <span style={{ color: '#e5e7eb' }}>{value}</span>
    </div>
  )

  const renderSelectionInfo = () => {
    if (selection.type === 'none') {
      return <div style={{ color: '#4b5563', fontSize: '10px' }}>Nichts ausgewählt</div>
    }

    const type = selection.type
    const icon = type === 'soldier' ? (UNIT_ICONS[selection.soldierType] ?? '⚔️')
               : type === 'army'   ? '⚔️'
               : (UNIT_ICONS[type] ?? '❓')
    const name = type === 'soldier' ? (UNIT_NAMES[selection.soldierType] ?? selection.soldierType)
               : type === 'army'   ? 'Armee'
               : (UNIT_NAMES[type] ?? type)

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f3f4f6' }}>{name}</span>
        </div>

        {type === 'worker' && (
          <>
            {statRow('Zustand', WORKER_STATE_DE[selection.workerState] ?? selection.workerState)}
            {statRow('Sammelrate', '10/Trip')}
            {statRow('Geschw.', '60')}
          </>
        )}

        {type === 'army' && (() => {
          const ratio = selection.totalHp / selection.maxTotalHp
          const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444'
          return (
            <>
              {statRow('Einheiten', selection.count)}
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
                HP {selection.totalHp}/{selection.maxTotalHp}
              </div>
              {progressBar(ratio, barColor)}
            </>
          )
        })()}

        {type === 'soldier' && (() => {
          const cfg = SOLDIER_CONFIGS[selection.soldierType]
          const ratio = selection.hp / selection.maxHp
          const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444'
          return (
            <>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
                HP {selection.hp}/{selection.maxHp}
              </div>
              {progressBar(ratio, barColor)}
              {statRow('Angriff', cfg.damage)}
              {statRow('Reichweite', selection.soldierType === 'swordsman' ? 'Nah' : '5 Fel.')}
              {statRow('Geschw.', cfg.speed)}
            </>
          )
        })()}

        {type === 'townhall' && (
          <>
            {statRow('HP', BUILDING_CONFIGS.townhall.hp)}
            <button
              style={{ ...btn(resources.wood >= 50 && training === null), marginTop: '4px' }}
              onClick={() => resources.wood >= 50 && training === null && EventBus.emit<void>('request-train-worker', undefined)}
            >
              + Arbeiter ({RESOURCE_SYMBOLS.wood}50)
            </button>
            {training !== null && (
              <>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>Training…</div>
                {progressBar(training.progress)}
              </>
            )}
          </>
        )}

        {type === 'barracks' && (() => {
          if (!selection.built) return <div style={{ fontSize: '10px', color: '#9ca3af' }}>Im Bau…</div>
          const t = selection.training
          const canSword  = resources.metal >= 50 && resources.food >= 20 && !t
          const canArcher = resources.wood >= 30 && resources.metal >= 30 && !t
          return (
            <>
              {statRow('HP', BUILDING_CONFIGS.barracks.hp)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                <button style={btn(canSword)} onClick={() => canSword && EventBus.emit<SoldierType>('request-train-soldier', 'swordsman')}>
                  ⚔️ Schwert ({RESOURCE_SYMBOLS.metal}50 {RESOURCE_SYMBOLS.food}20)
                </button>
                <button style={btn(canArcher)} onClick={() => canArcher && EventBus.emit<SoldierType>('request-train-soldier', 'archer')}>
                  🏹 Bogner ({RESOURCE_SYMBOLS.wood}30 {RESOURCE_SYMBOLS.metal}30)
                </button>
              </div>
              {t && (
                <>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                    {t.soldierType === 'swordsman' ? '⚔️' : '🏹'} Training…
                  </div>
                  {progressBar(t.progress, '#a78bfa')}
                </>
              )}
            </>
          )
        })()}

        {type === 'farm' && (
          <>
            {statRow('HP', BUILDING_CONFIGS.farm.hp)}
            {statRow('Produktion', selection.built ? `+5 ${RESOURCE_SYMBOLS.food}/s` : 'Im Bau…')}
          </>
        )}

        {type === 'mine' && (
          <>
            {statRow('HP', BUILDING_CONFIGS.mine.hp)}
            {statRow('Produktion', selection.built ? `+2 ${RESOURCE_SYMBOLS.metal}/s` : 'Im Bau…')}
          </>
        )}

        {type === 'watchtower' && (
          <>
            {statRow('HP', BUILDING_CONFIGS.watchtower.hp)}
            {statRow('Angriff', selection.built ? `${BUILDING_CONFIGS.watchtower.attackDamage} Schaden` : 'Im Bau…')}
            {statRow('Reichweite', '5.5 Fel.')}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{
      width: '128px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0,0,0,0.92)',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      fontFamily: 'monospace',
      userSelect: 'none',
      pointerEvents: 'auto',
      overflow: 'hidden',
    }}>

      {/* Selection info */}
      <div style={{ flex: 1, padding: '6px', overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {renderSelectionInfo()}
      </div>

      {/* T11: select all soldiers */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <button
          style={{ ...btn(true), fontSize: '10px', textAlign: 'center' as const }}
          onClick={() => EventBus.emit<void>('select-all-soldiers', undefined)}
        >
          Alle auswählen
        </button>
      </div>

      {/* Build menu */}
      <div style={{ padding: '6px', flexShrink: 0 }}>
        {buildMode !== null ? (
          <>
            <div style={{ fontSize: '10px', color: '#fbbf24', marginBottom: '4px' }}>
              {buildPreview?.ready ? 'Vorschau prüfen' : 'Position antippen'}
            </div>
            {buildPreview?.ready && (
              <button
                style={{
                  ...btn(buildPreview.valid),
                  marginBottom: '4px',
                  textAlign: 'center' as const,
                  background: buildPreview.valid ? 'rgba(34,197,94,0.22)' : 'rgba(75,85,99,0.18)',
                  border: buildPreview.valid ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)',
                  color: buildPreview.valid ? '#bbf7d0' : '#6b7280',
                }}
                disabled={!buildPreview.valid}
                onClick={() => buildPreview.valid && EventBus.emit<void>('confirm-build', undefined)}
              >
                ✓ Bau bestätigen
              </button>
            )}
            <button
              style={{ ...btn(true), background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5' }}
              onClick={() => EventBus.emit<void>('cancel-build', undefined)}
            >
              Abbrechen
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {BUILD_BUTTONS.map(({ type, icon }) => {
              const affordable = canAffordBuilding(type)
              return (
                <button
                  key={type}
                  style={btn(affordable)}
                  onClick={() => affordable && EventBus.emit<BuildingType>('start-build', type)}
                >
                  {icon} {UNIT_NAMES[type]}<br />
                  <span style={{ fontSize: '9px', color: affordable ? '#9ca3af' : '#374151' }}>{formatResourceCost(BUILDING_CONFIGS[type].cost)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
