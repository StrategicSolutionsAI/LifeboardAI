"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Plus, Settings, User, Calendar, Clock, 
  BarChart3, Heart, DollarSign, Home,
  Target, FileText, Users, Briefcase,
  Activity, TrendingUp, MessageSquare,
  Bell, Search, Globe
} from "lucide-react"
import { WidgetLibrary } from "./widget-library"
import { TaskColumn } from "./task-column"
import { HealthWidgets } from "./health-widgets"

export function DashboardLayout() {
  const router = useRouter()
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const [selectedBoard, setSelectedBoard] = useState("health")
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false)

  const sidebarNavigation = [
    { name: 'Calendar', id: 'calendar', icon: Calendar },
    { name: 'Profile', id: 'profile', icon: User },
    { name: 'Home', id: 'home', icon: Home },
    { name: 'Tasks', id: 'tasks', icon: FileText },
    { name: 'History', id: 'history', icon: Clock },
    { name: 'Settings', id: 'settings', icon: Settings },
  ]

  const topNavigation = [
    { name: 'HEALTH', id: 'health', active: true },
    { name: 'WELLNESS', id: 'wellness', active: false },
    { name: 'HOME', id: 'home', active: false },
    { name: 'PLANNER', id: 'planner', active: false },
    { name: 'FAMILY', id: 'family', active: false },
    { name: 'FINANCE', id: 'finance', active: false },
    { name: 'MEALS', id: 'meals', active: false },
    { name: 'WORK', id: 'work', active: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-6">
        {sidebarNavigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">TaskBoard</h1>
              </div>
              
              <div className="text-gray-600">
                <span className="text-sm">Hello Dalit</span>
                <span className="text-xs ml-2 text-gray-400">You got this!</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Globe className="w-4 h-4" />
                <MessageSquare className="w-4 h-4" />
                <Search className="w-4 h-4" />
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">93°</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex space-x-8">
            {topNavigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedBoard(item.id)}
                className={`py-4 px-2 text-xs font-medium tracking-wide border-b-2 transition-colors ${
                  selectedBoard === item.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Main Widgets Area */}
              <div className="lg:col-span-3">
                {selectedBoard === "health" && <HealthWidgets />}
                {selectedBoard !== "health" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {/* Add Widget Card */}
                    <Sheet open={isWidgetLibraryOpen} onOpenChange={setIsWidgetLibraryOpen}>
                      <SheetTrigger asChild>
                        <Card className="border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer transition-colors group">
                          <CardContent className="flex flex-col items-center justify-center p-8 min-h-[200px]">
                            <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
                              <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Add Widget</h3>
                            <p className="text-sm text-gray-500 text-center">
                              Choose from our library of widgets to track what matters most
                            </p>
                          </CardContent>
                        </Card>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px]">
                        <SheetHeader>
                          <SheetTitle>Widget Library</SheetTitle>
                          <SheetDescription>
                            Add widgets to track your goals and habits
                          </SheetDescription>
                        </SheetHeader>
                        <WidgetLibrary />
                      </SheetContent>
                    </Sheet>
                  </div>
                )}
              </div>

              {/* Right Sidebar - Calendar & Tasks */}
              <div className="lg:col-span-1">
                <TaskColumn />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
