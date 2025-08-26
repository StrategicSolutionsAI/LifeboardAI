"use client"

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface WidgetErrorFallbackProps {
  error?: Error
  retry: () => void
}

function WidgetErrorFallback({ error, retry }: WidgetErrorFallbackProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
          Widget Error
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 mb-3">
            This widget encountered an error and couldn't load properly.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={retry}
            className="text-xs relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:scale-105 active:scale-95 group"
          >
            <RefreshCw className="h-3 w-3 mr-1 transition-transform duration-300 group-hover:rotate-180" />
            <span className="relative z-10 font-medium">Retry</span>
            {/* Subtle hover effect */}
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
            <code className="text-red-700">{error.message}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface WidgetErrorBoundaryProps {
  children: React.ReactNode
  widgetName?: string
}

export function WidgetErrorBoundary({ children, widgetName }: WidgetErrorBoundaryProps) {
  return (
    <ErrorBoundary 
      fallback={WidgetErrorFallback}
      onError={(error, errorInfo) => {
        console.error(`Widget error in ${widgetName || 'unknown widget'}:`, error)
        // Additional widget-specific error handling could go here
      }}
    >
      {children}
    </ErrorBoundary>
  )
}