'use client'

import dynamic from 'next/dynamic'

const GameWrapper = dynamic(() => import('@/components/GameWrapper'), { ssr: false })

export default function HomePage() {
  return (
    <main className="w-full h-full overflow-hidden bg-black">
      <GameWrapper />
    </main>
  )
}
