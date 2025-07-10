"use client"

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  loading: boolean
  progress?: number
  showPercentage?: boolean
  className?: string
}

export function ProgressIndicator({ 
  loading, 
  progress = 0, 
  showPercentage = false,
  className 
}: ProgressIndicatorProps) {
  const [visible, setVisible] = useState(loading)
  const [displayProgress, setDisplayProgress] = useState(progress)
  
  useEffect(() => {
    if (loading) {
      setVisible(true)
    } else {
      // Delay hiding to show completion
      const timer = setTimeout(() => setVisible(false), 500)
      return () => clearTimeout(timer)
    }
  }, [loading])
  
  useEffect(() => {
    // Smooth progress animation
    const diff = progress - displayProgress
    if (Math.abs(diff) < 1) {
      setDisplayProgress(progress)
      return
    }
    
    const timer = setTimeout(() => {
      setDisplayProgress(prev => prev + diff * 0.1)
    }, 16) // ~60fps
    
    return () => clearTimeout(timer)
  }, [progress, displayProgress])
  
  if (!visible) return null
  
  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50", className)}>
      <div className="h-1 bg-gray-100 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
          style={{ 
            width: `${displayProgress}%`,
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
          }}
        />
      </div>
      {showPercentage && displayProgress > 0 && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
          {Math.round(displayProgress)}%
        </div>
      )}
    </div>
  )
}

// Micro progress for individual components
export function MicroProgress({ loading }: { loading: boolean }) {
  if (!loading) return null
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
    </div>
  )
}

// Skeleton with progress
export function SkeletonWithProgress({ 
  loading, 
  children,
  skeleton,
  className 
}: { 
  loading: boolean
  children: React.ReactNode
  skeleton: React.ReactNode
  className?: string
}) {
  const [showSkeleton, setShowSkeleton] = useState(loading)
  
  useEffect(() => {
    if (!loading && showSkeleton) {
      // Fade out skeleton
      const timer = setTimeout(() => setShowSkeleton(false), 200)
      return () => clearTimeout(timer)
    } else if (loading && !showSkeleton) {
      setShowSkeleton(true)
    }
  }, [loading, showSkeleton])
  
  return (
    <div className={cn("relative", className)}>
      {showSkeleton ? (
        <div className="animate-in fade-in duration-200">
          {skeleton}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

// Loading dots animation
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
    </span>
  )
}
