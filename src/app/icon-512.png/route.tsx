import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 320,
          background: '#B1916A',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 96,
          color: 'white',
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        L
      </div>
    ),
    { width: 512, height: 512 }
  )
}
