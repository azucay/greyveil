import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
            width: '152px',
            height: '152px',
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
              fontSize: '88px',
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
    { width: 192, height: 192 }
  )
}
