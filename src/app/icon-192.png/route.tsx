import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          background: '#B1916A',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
          color: 'white',
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        L
      </div>
    ),
    { width: 192, height: 192 }
  )
}
