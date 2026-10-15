import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
            width: '140px',
            height: '140px',
            backgroundColor: '#1e3a5f',
            borderRadius: '24px',
            border: '5px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '90px',
              fontWeight: '900',
              color: '#60a5fa',
              lineHeight: 1,
              fontFamily: 'serif',
              marginTop: '-6px',
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
