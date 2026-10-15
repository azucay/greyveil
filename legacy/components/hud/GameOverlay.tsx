'use client'

import { useState, useEffect } from 'react'
import { EventBus } from '@/game/EventBus'

export default function GameOverlay() {
  const [result, setResult] = useState<'victory' | 'defeat' | null>(null)

  useEffect(() => {
    const handler = (r: 'victory' | 'defeat') => setResult(r)
    EventBus.on<'victory' | 'defeat'>('game-over', handler)
    return () => EventBus.off<'victory' | 'defeat'>('game-over', handler)
  }, [])

  if (!result) return null

  const isVictory = result === 'victory'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
      fontFamily: 'monospace',
      userSelect: 'none',
    }}>
      <div style={{
        border: `2px solid ${isVictory ? '#22c55e' : '#ef4444'}`,
        borderRadius: '8px',
        padding: '32px 48px',
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '16px',
        maxWidth: '320px', width: '90%',
      }}>
        <div style={{
          fontSize: '42px',
          lineHeight: 1,
        }}>
          {isVictory ? '⚔️' : '💀'}
        </div>
        <h1 style={{
          color: isVictory ? '#22c55e' : '#ef4444',
          fontSize: '28px',
          margin: 0,
          letterSpacing: '4px',
        }}>
          {isVictory ? 'SIEG' : 'NIEDERLAGE'}
        </h1>
        <p style={{
          color: '#9ca3af',
          fontSize: '12px',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          {isVictory
            ? 'Das feindliche Rathaus wurde zerstört.'
            : 'Dein Rathaus wurde zerstört.'}
        </p>
        <button
          style={{
            marginTop: '8px',
            padding: '10px 28px',
            borderRadius: '6px',
            border: `1px solid ${isVictory ? '#22c55e' : '#ef4444'}`,
            background: isVictory ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: '#e5e7eb',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'monospace',
            touchAction: 'manipulation',
            letterSpacing: '1px',
          }}
          onClick={() => window.location.reload()}
        >
          Neu starten
        </button>
      </div>
    </div>
  )
}
