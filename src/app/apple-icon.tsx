import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
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
    { ...size }
  )
}
