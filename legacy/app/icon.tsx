import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#1a1a2e',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '400px',
            height: '400px',
            backgroundColor: '#1e3a5f',
            borderRadius: '60px',
            border: '12px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '260px',
              fontWeight: '900',
              color: '#60a5fa',
              lineHeight: 1,
              fontFamily: 'serif',
              marginTop: '-16px',
            }}
          >
            G
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
