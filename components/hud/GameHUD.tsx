'use client'

import { useState, useEffect } from 'react'
import { EventBus } from '@/game/EventBus'
import type { GameSelection } from '@/types/units'
import type { BuildingType } from '@/types/buildings'
import type { Resources } from '@/types/resources'

interface Props {
  resources: Resources
}

const BUILD_BUTTONS: { type: BuildingType; label: string; costLabel: string }[] = [
  { type: 'farm', label: 'Farm', costLabel: '60W' },
  { type: 'mine', label: 'Mine', costLabel: '80W+60S' },
  { type: 'barracks', label: 'Barracks', costLabel: '100W+80S' },
]

export default function GameHUD({ resources }: Props) {
  const [selection, setSelection] = useState<GameSelection>({ type: 'none' })
  const [buildMode, setBuildMode] = useState<BuildingType | null>(null)
  const [popCount, setPopCount] = useState<number>(3)
  const [popCap] = useState<number>(10)
  const [training, setTraining] = useState<{ progress: number } | null>(null)

  useEffect(() => {
    const onSelectionChanged = (s: GameSelection) => setSelection(s)
    const onBuildModeChanged = (mode: BuildingType | null) => setBuildMode(mode)
    const onTrainingUpdate = (t: { progress: number } | null) => setTraining(t)
    const onPopChanged = (count: number) => setPopCount(count)

    EventBus.on<GameSelection>('selection-changed', onSelectionChanged)
    EventBus.on<BuildingType | null>('build-mode-changed', onBuildModeChanged)
    EventBus.on<{ progress: number } | null>('training-update', onTrainingUpdate)
    EventBus.on<number>('pop-changed', onPopChanged)

    return () => {
      EventBus.off<GameSelection>('selection-changed', onSelectionChanged)
      EventBus.off<BuildingType | null>('build-mode-changed', onBuildModeChanged)
      EventBus.off<{ progress: number } | null>('training-update', onTrainingUpdate)
      EventBus.off<number>('pop-changed', onPopChanged)
    }
  }, [])

  const handleStartBuild = (type: BuildingType) => {
    EventBus.emit<BuildingType>('start-build', type)
  }

  const handleCancelBuild = () => {
    EventBus.emit<void>('cancel-build', undefined)
  }

  const handleTrainWorker = () => {
    EventBus.emit<void>('request-train-worker', undefined)
  }

  const canAfford = (type: BuildingType): boolean => {
    if (type === 'farm') return resources.wood >= 60
    if (type === 'mine') return resources.wood >= 80 && resources.stone >= 60
    if (type === 'barracks') return resources.wood >= 100 && resources.stone >= 80
    return false
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.85)',
    borderTop: '1px solid rgba(255,255,255,0.15)',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '6px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    userSelect: 'none',
    pointerEvents: 'auto',
    zIndex: 10,
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  }

  const btnStyle = (active: boolean, affordable: boolean = true): React.CSSProperties => ({
    padding: '3px 8px',
    borderRadius: '4px',
    border: `1px solid ${active ? '#60a5fa' : 'rgba(255,255,255,0.2)'}`,
    background: active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
    color: affordable ? '#e5e7eb' : '#6b7280',
    cursor: affordable ? 'pointer' : 'not-allowed',
    fontSize: '11px',
    fontFamily: 'monospace',
  })

  const cancelBtnStyle: React.CSSProperties = {
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #ef4444',
    background: 'rgba(239,68,68,0.2)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: 'monospace',
  }

  const progressBarStyle = (): React.CSSProperties => ({
    display: 'inline-block',
    width: '80px',
    height: '6px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '3px',
    overflow: 'hidden',
    verticalAlign: 'middle',
    marginLeft: '4px',
  })

  const progressFillStyle = (progress: number): React.CSSProperties => ({
    height: '100%',
    width: `${Math.round(progress * 100)}%`,
    background: '#22c55e',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
  })

  const renderTopRow = () => {
    return (
      <div style={rowStyle}>
        <span style={{ color: '#9ca3af', marginRight: '4px' }}>
          Pop: {popCount}/{popCap}
        </span>
        {buildMode !== null ? (
          <>
            <button style={cancelBtnStyle} onClick={handleCancelBuild}>
              Cancel
            </button>
            <span style={{ color: '#fbbf24' }}>
              Tap map to place {buildMode}
            </span>
          </>
        ) : (
          BUILD_BUTTONS.map(({ type, label, costLabel }) => {
            const affordable = canAfford(type)
            return (
              <button
                key={type}
                style={btnStyle(false, affordable)}
                onClick={() => affordable && handleStartBuild(type)}
                disabled={!affordable}
              >
                {label} ({costLabel})
              </button>
            )
          })
        )}
      </div>
    )
  }

  const renderBottomRow = () => {
    if (selection.type === 'none') {
      return (
        <div style={{ color: '#6b7280' }}>
          Click a unit or building to select
        </div>
      )
    }

    if (selection.type === 'worker') {
      return (
        <div style={rowStyle}>
          <span style={{ color: '#60a5fa' }}>Worker</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span>{selection.workerState}</span>
        </div>
      )
    }

    if (selection.type === 'townhall') {
      return (
        <div style={rowStyle}>
          <span style={{ color: '#f59e0b' }}>Town Hall</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <button
            style={btnStyle(false, resources.wood >= 50 && training === null)}
            onClick={handleTrainWorker}
            disabled={resources.wood < 50 || training !== null}
          >
            Train Worker (50W)
          </button>
          {training !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#9ca3af' }}>Training...</span>
              <span style={progressBarStyle()}>
                <span style={progressFillStyle(training.progress)} />
              </span>
              <span style={{ color: '#9ca3af' }}>
                {Math.round(training.progress * 100)}%
              </span>
            </span>
          )}
        </div>
      )
    }

    if (selection.type === 'barracks') {
      return (
        <div style={rowStyle}>
          <span style={{ color: '#f97316' }}>Barracks</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span>{selection.built ? 'Ready' : 'Under Construction'}</span>
        </div>
      )
    }

    if (selection.type === 'farm') {
      return (
        <div style={rowStyle}>
          <span style={{ color: '#4ade80' }}>Farm</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span>{selection.built ? 'Ready (+5 food/s)' : 'Under Construction'}</span>
        </div>
      )
    }

    if (selection.type === 'mine') {
      return (
        <div style={rowStyle}>
          <span style={{ color: '#94a3b8' }}>Mine</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span>{selection.built ? 'Ready (+2 metal/s)' : 'Under Construction'}</span>
        </div>
      )
    }

    return null
  }

  return (
    <div style={panelStyle}>
      {renderTopRow()}
      {renderBottomRow()}
    </div>
  )
}
