import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Greyveil',
  description: 'Fantasy RTS Browser Game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className="bg-black overflow-hidden w-full h-full">
        {children}
      </body>
    </html>
  )
}
