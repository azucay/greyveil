'use client'

import { useRef, useEffect } from 'react'
import { EventBus } from '@/game/EventBus'
import type { MinimapData } from '@/types/minimap'

const W = 120
const H = 90

export default function MinimapHUD() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const onMinimap = (data: MinimapData) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const scaleX = W / data.mapW
      const scaleY = H / data.mapH

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(10,15,30,0.85)'
      ctx.fillRect(0, 0, W, H)

      for (const b of data.buildings) {
        ctx.fillStyle = b.faction === 'player' ? '#3b82f6' : '#ef4444'
        ctx.fillRect(b.wx * scaleX - 2, b.wy * scaleY - 2, 5, 5)
      }

      for (const s of data.soldiers) {
        ctx.fillStyle = s.faction === 'player' ? '#60a5fa' : '#f87171'
        ctx.beginPath()
        ctx.arc(s.wx * scaleX, s.wy * scaleY, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(
        data.cameraX * scaleX,
        data.cameraY * scaleY,
        data.cameraW * scaleX,
        data.cameraH * scaleY,
      )
    }

    EventBus.on<MinimapData>('minimap-update', onMinimap)
    return () => { EventBus.off<MinimapData>('minimap-update', onMinimap) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '3px',
        pointerEvents: 'none',
      }}
    />
  )
}
