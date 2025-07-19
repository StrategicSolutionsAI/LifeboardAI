"use client"

import { WithingsWeightWidget } from '@/components/withings-weight-widget'
// import { WeightTrackingDashboard } from '@/components/weight-tracking-dashboard'
import { ToastProvider } from '@/components/ui/use-toast'

export default function TestWithingsPage() {
  return (
    <ToastProvider>
      <div className="container mx-auto p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Withings Weight Tracking Test</h1>
          <p className="text-gray-600">Test the automatic weight tracking functionality</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Simple Widget */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Simple Weight Widget</h2>
            <WithingsWeightWidget
              showControls={true}
              unit="lbs"
              goalWeight={145}
              startingWeight={155}
            />
          </div>

          {/* Compact Widget */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Compact Widget</h2>
            <WithingsWeightWidget
              showControls={false}
              unit="kg"
              goalWeight={66}
              startingWeight={70}
            />
          </div>
        </div>

        {/* API Test */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">API Connection Test</h2>
          <div className="bg-white p-4 border rounded-lg">
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/integrations/withings/metrics')
                  const data = await response.json()
                  console.log('API Response:', data)
                  alert(response.ok ? `Success: ${JSON.stringify(data)}` : `Error: ${data.error}`)
                } catch (error) {
                  console.error('API Error:', error)
                  alert(`Error: ${error}`)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Withings API
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Connection Status</h3>
          <div className="space-y-2 text-sm">
            <div>• If you see "Withings connection expired" - you need to reconnect your Withings account</div>
            <div>• If you see "Rate limited" - wait a few minutes and try again</div>
            <div>• If you see "Not authenticated" - make sure you're logged in</div>
            <div>• If you see weight data - everything is working correctly!</div>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
