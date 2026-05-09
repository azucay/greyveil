'use client'

import GameCanvas from './GameCanvas'

export default function GameWrapper() {
  return (
    <div className="relative w-full h-full">
      <GameCanvas />
    </div>
  )
}
