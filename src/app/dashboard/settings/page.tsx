'use client'

import { GoogleFitAuthButton } from '@/components/auth/google-fit-auth-button'
import { signInWithGoogleFit } from '@/app/login/actions'

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-xl font-semibold mb-2">Integrations</h2>
        <p className="text-gray-500 mb-6">
          Connect your Lifeboard to other services to automatically track your progress.
        </p>
        
        <div className="border-t pt-6">
          <div className="max-w-sm">
            <GoogleFitAuthButton authAction={signInWithGoogleFit} />
            <p className="text-xs text-gray-400 mt-2">You will be asked to grant permissions to read your activity and health data.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
