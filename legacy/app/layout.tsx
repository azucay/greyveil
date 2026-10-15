import type { Metadata, Viewport } from 'next'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Greyveil',
  description: 'Fantasy RTS Browser Game',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Greyveil',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className="bg-black overflow-hidden w-full h-full">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
