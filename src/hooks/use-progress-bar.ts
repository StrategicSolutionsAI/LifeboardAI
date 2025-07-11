import { useEffect } from 'react'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// Configure NProgress once
NProgress.configure({ showSpinner: false, trickleSpeed: 120 })

/**
 * React hook to automatically show / hide a thin top progress bar
 * based on a boolean `loading` flag.
 */
export function useProgressBar(loading: boolean) {
  useEffect(() => {
    if (loading) {
      NProgress.start()
    } else {
      NProgress.done()
    }
  }, [loading])
}
