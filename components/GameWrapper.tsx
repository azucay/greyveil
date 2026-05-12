'use client'

import { useState, useEffect } from 'react'
import GameCanvas from './GameCanvas'
import LeftPanel from './hud/LeftPanel'
import ResourceHUD from './hud/ResourceHUD'
import GameOverlay from './hud/GameOverlay'
import MinimapHUD from './hud/MinimapHUD'
import { EventBus } from '@/game/EventBus'
import type { Resources } from '@/types/resources'

const DEFAULT_RESOURCES: Resources = {
  wood: 200,
  stone: 150,
  food: 50,
  metal: 0,
  gold: 0,
}

export default function GameWrapper() {
  const [resources, setResources] = useState<Resources>(DEFAULT_RESOURCES)
  const [popCount, setPopCount]   = useState(3)
  const [popCap, setPopCap]       = useState(10)

  useEffect(() => {
    const onResources = (r: Resources)                        => setResources(r)
    const onPop       = ({ count, cap }: { count: number; cap: number }) => { setPopCount(count); setPopCap(cap) }
    EventBus.on<Resources>('resources-updated', onResources)
    EventBus.on<{ count: number; cap: number }>('pop-update', onPop)
    return () => {
      EventBus.off<Resources>('resources-updated', onResources)
      EventBus.off<{ count: number; cap: number }>('pop-update', onPop)
    }
  }, [])

  return (
    <div className="flex flex-col w-full h-full">
      <ResourceHUD resources={resources} popCount={popCount} popCap={popCap} />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel resources={resources} />
        <div className="flex-1 relative overflow-hidden">
          <GameCanvas />
          <GameOverlay />
          <MinimapHUD />
        </div>
      </div>
    </div>
  )
}
