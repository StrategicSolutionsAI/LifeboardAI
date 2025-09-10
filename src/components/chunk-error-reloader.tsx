"use client"

import { useEffect } from 'react'

export function ChunkErrorReloader() {
  useEffect(() => {
    const onReject = (e: any) => {
      const name = e?.reason?.name || ''
      const msg = e?.reason?.message || e?.message || ''
      if (name === 'ChunkLoadError' || /chunk/i.test(msg)) {
        try { sessionStorage.setItem('lb_last_chunk_reload', String(Date.now())) } catch {}
        window.location.reload()
      }
    }
    window.addEventListener('unhandledrejection', onReject)
    return () => window.removeEventListener('unhandledrejection', onReject)
  }, [])
  return null
}

