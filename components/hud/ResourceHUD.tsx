'use client'

import type { Resources } from '@/types/resources'

interface Props {
  resources: Resources
}

const RESOURCE_CONFIG: { key: keyof Resources; label: string; color: string; bg: string }[] = [
  { key: 'food', label: 'Food', color: '#4ade80', bg: '#14532d' },
  { key: 'wood', label: 'Wood', color: '#86efac', bg: '#166534' },
  { key: 'stone', label: 'Stone', color: '#d1d5db', bg: '#374151' },
  { key: 'metal', label: 'Metal', color: '#cbd5e1', bg: '#1e293b' },
  { key: 'gold', label: 'Gold', color: '#fcd34d', bg: '#78350f' },
]

export default function ResourceHUD({ resources }: Props) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center gap-2 py-1.5 px-4 select-none pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
    >
      {RESOURCE_CONFIG.map(({ key, label, color, bg }) => (
        <div
          key={key}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: bg, border: `1px solid ${color}33` }}
        >
          <span style={{ color: '#9ca3af' }}>{label}</span>
          <span style={{ color, fontWeight: 'bold', minWidth: '2.5rem', textAlign: 'right' }}>
            {Math.floor(resources[key])}
          </span>
        </div>
      ))}
    </div>
  )
}
