import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Greyveil',
    short_name: 'Greyveil',
    description: 'Fantasy RTS Browser Game',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    theme_color: '#1a1a2e',
    background_color: '#0d0d1a',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
