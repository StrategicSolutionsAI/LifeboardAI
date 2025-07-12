'use client'

import React, { useState } from 'react'
import { GoogleFitAuthButton } from '@/components/auth/google-fit-auth-button'
import { signInWithGoogleFit } from '@/app/login/actions'
import { Settings, Check, AlertCircle, ExternalLink, Palette } from 'lucide-react'
import { themeColors, ThemeColor } from '@/lib/theme'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

type Integration = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  connected: boolean
  action: () => void
}

import { SidebarLayout } from '@/components/sidebar-layout'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-fit',
      name: 'Google Fit',
      description: 'Connect to track your fitness activities and health metrics',
      icon: <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24">
          <path fill="currentColor" d="M17.99 17.99v-1.5h1.5v1.5h-1.5zm-12-6.5v-1.5h1.5v1.5h-1.5zm6-2.5a5.5 5.5 0 0 1 5.5 5.5h-1.5a4 4 0 0 0-4-4v-1.5zm-5.5 1.5v-1.5h1.5v1.5h-1.5zm3-3v-1.5h1.5v1.5h-1.5zm8 2a7.5 7.5 0 0 0-7.5-7.5v1.5a6 6 0 0 1 6 6h1.5zm-13-3v-1.5h1.5v1.5h-1.5zm3-3v-1.5h1.5v1.5h-1.5zm-3 0v-1.5h1.5v1.5h-1.5z"/>
        </svg>
      </div>,
      connected: false,
      action: signInWithGoogleFit
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync your calendar events and schedule',
      icon: <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24">
          <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM7 12h5v5H7v-5z"/>
        </svg>
      </div>,
      connected: false,
      action: () => console.log('Connect Google Calendar')
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and manage tasks from Slack',
      icon: <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24">
          <path fill="currentColor" d="M6 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 0 1-2 2v-2h2zm-2-8a2 2 0 1 1 2-2v2H5zm0 1a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2zm9-1a2 2 0 1 1-2-2 2 2 0 0 1 2 2zm-2 2a2 2 0 0 1 2-2V6a4 4 0 0 0-4 4h2zm-7 7a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2zm2-2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2zm2-2a2 2 0 0 1-2-2H6a4 4 0 0 0 4 4v-2zm0 0a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2z"/>
        </svg>
      </div>,
      connected: false,
      action: () => console.log('Connect Slack')
    }
  ])

  const handleConnect = (integrationId: string) => {
    const integration = integrations.find((i: Integration) => i.id === integrationId)
    if (integration) {
      integration.action()
      // In a real app, you would update the integration status after successful connection
      setIntegrations((prev: Integration[]) => prev.map((i: Integration) => 
        i.id === integrationId ? { ...i, connected: true } : i
      ))
    }
  }

  return (
    <SidebarLayout>
      <div className="p-6 max-w-4xl mx-auto min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-gray-600" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <div className="space-y-8">
        {/* Account Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium">Profile Information</h3>
                <p className="text-sm text-gray-500">Update your name, email, and other account details</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md">
                Edit Profile
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium">Change Password</h3>
                <p className="text-sm text-gray-500">Update your account password</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md">
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="text-xl font-semibold">Appearance</h2>
              <p className="text-gray-500">Customize your theme and color preferences</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Theme Colors</h3>
              <p className="text-sm text-gray-500 mb-4">Choose a color scheme that matches your style</p>
              
              <div className="grid grid-cols-1 gap-3">
                {themeColors.map((colorTheme) => (
                  <button
                    key={colorTheme.id}
                    onClick={() => setTheme(colorTheme)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-all text-left",
                      theme.id === colorTheme.id
                        ? "border-theme-primary bg-theme-primary bg-opacity-10"
                        : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Color preview circles */}
                        <div className="flex gap-1">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-200"
                            style={{ backgroundColor: colorTheme.primary }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-200"
                            style={{ backgroundColor: colorTheme.secondary }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-200"
                            style={{ backgroundColor: colorTheme.accent }}
                          />
                        </div>
                        
                        <div>
                          <h4 className="text-[16px] font-medium text-[#171A1F]">{colorTheme.name}</h4>
                          <p className="text-[14px] text-[#6B7280]">{colorTheme.description}</p>
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {theme.id === colorTheme.id && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-theme-primary">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Preview section */}
              <div className="flex flex-col gap-3 mt-6 p-4 bg-[#F9FAFB] rounded-lg border">
                <h4 className="text-[16px] font-medium text-[#171A1F]">Preview</h4>
                <div className="flex items-center gap-3 flex-wrap">
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Primary Button
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    Secondary
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: theme.accent }}
                  >
                    Accent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Integrations</h2>
              <p className="text-gray-500">Connect your favorite apps and services</p>
            </div>
            <a 
              href="#" 
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              View all integrations <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          <div className="space-y-4">
            {integrations.map((integration: Integration) => (
              <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  {integration.icon}
                  <div>
                    <h3 className="font-medium">{integration.name}</h3>
                    <p className="text-sm text-gray-500">{integration.description}</p>
                  </div>
                </div>
                {integration.connected ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
          <div className="space-y-4">
            <div className="flex items-start p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-800">Danger Zone</h3>
                <p className="text-sm text-yellow-700 mb-3">
                  These actions are irreversible. Please proceed with caution.
                </p>
                <div className="flex gap-3">
                  <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md transition-colors">
                    Delete Account
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-md transition-colors">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </SidebarLayout>
  )
}
