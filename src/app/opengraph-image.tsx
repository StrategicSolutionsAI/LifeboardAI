import { ImageResponse } from 'next/og'

export const alt = 'Lifeboard.ai - Organize Your Life, Effortlessly With AI'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #F6F6FC 0%, #EDE8E2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#B1916A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontWeight: 700,
              color: 'white',
            }}
          >
            L
          </div>
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#171A1F',
              letterSpacing: -1,
            }}
          >
            Lifeboard.ai
          </span>
        </div>

        <div
          style={{
            fontSize: 32,
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          Organize Your Life, Effortlessly With AI
        </div>

        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
            color: '#B1916A',
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          <span>Tasks</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span>Calendar</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span>Health</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span>Habits</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
