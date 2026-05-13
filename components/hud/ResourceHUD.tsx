'use client'

import type { Resources, ResourceType } from '@/types/resources'
import { RESOURCE_SYMBOLS } from '@/types/resources'

interface Props {
  resources: Resources
  popCount: number
  popCap: number
}

const RESOURCE_CONFIG: { key: ResourceType; color: string; bg: string }[] = [
  { key: 'food', color: '#4ade80', bg: '#14532d' },
  { key: 'wood', color: '#86efac', bg: '#166534' },
  { key: 'stone', color: '#d1d5db', bg: '#374151' },
  { key: 'metal', color: '#cbd5e1', bg: '#1e293b' },
  { key: 'gold', color: '#fcd34d', bg: '#78350f' },
]

export default function ResourceHUD({ resources, popCount, popCap }: Props) {
  return (
    <div
      className="flex justify-center flex-wrap gap-1 py-1 px-2 select-none pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
    >
      {RESOURCE_CONFIG.map(({ key, color, bg }) => (
        <div
          key={key}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono"
          style={{ background: bg, border: `1px solid ${color}33`, fontSize: '11px' }}
          title={key}
        >
          <span aria-hidden="true">{RESOURCE_SYMBOLS[key]}</span>
          <span style={{ color, fontWeight: 'bold', minWidth: '1.8rem', textAlign: 'right' }}>
            {Math.floor(resources[key])}
          </span>
        </div>
      ))}
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono"
        style={{ background: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
      >
        <span style={{ color: '#9ca3af' }}>👥</span>
        <span style={{ color: '#e5e7eb', fontWeight: 'bold', minWidth: '2rem', textAlign: 'right' }}>
          {popCount}/{popCap}
        </span>
      </div>
    </div>
  )
}
