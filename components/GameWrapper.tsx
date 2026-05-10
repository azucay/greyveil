'use client'

import { useState, useEffect } from 'react'
import GameCanvas from './GameCanvas'
import LeftPanel from './hud/LeftPanel'
import GameOverlay from './hud/GameOverlay'
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

  useEffect(() => {
    const handler = (newResources: Resources) => setResources(newResources)
    EventBus.on<Resources>('resources-updated', handler)
    return () => EventBus.off<Resources>('resources-updated', handler)
  }, [])

  return (
    <div className="flex w-full h-full">
      <LeftPanel resources={resources} />
      <div className="flex-1 relative overflow-hidden">
        <GameCanvas />
        <GameOverlay />
      </div>
    </div>
  )
}
