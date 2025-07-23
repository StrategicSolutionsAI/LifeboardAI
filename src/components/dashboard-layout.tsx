"use client"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Plus, Settings, User, Calendar, Clock, Filter,
  Home, FileText, MessageSquare, MoreHorizontal,
  Bell, Search, Globe, Cloud, BarChart2
} from "lucide-react"
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { getUserPreferencesClient } from "@/lib/user-preferences"
import { DynamicBucketTabs } from "./dynamic-bucket-tabs"
import { TaskColumn } from "./task-column"
import { HealthWidgets } from "./health-widgets"
import { WidgetLibrary } from "./widget-library"

export function DashboardLayout() {
  const router = useRouter()
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const [selectedBoard, setSelectedBoard] = useState("Health")
  const [userName, setUserName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  // Calendar helpers
  const today = new Date()
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(today, i))

  // Fetch user profile information
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .single()

          if (profile && profile.first_name) {
            setUserName(profile.first_name)
          } else {
            const email = user.email || ''
            const name = email.split('@')[0] || 'there'
            setUserName(name)
          }
        }
      } catch (error) {
        console.error('Error loading user profile', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [])

  const sidebarNavigation = [
    { name: 'Calendar', id: 'calendar', icon: Calendar },
    { name: 'Profile', id: 'profile', icon: User },
    { name: 'Home', id: 'home', icon: Home },
    { name: 'Tasks', id: 'tasks', icon: FileText },
    { name: 'History', id: 'history', icon: Clock },
    { name: 'Settings', id: 'settings', icon: Settings },
  ]

  // Empty state component for when no widgets have been added
  const EmptyBucketState = () => {
    const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false);
    
    return (
      <div className="flex flex-col items-center justify-center py-12 px-8 text-center h-full">
        <div className="bg-theme-primary bg-opacity-10 p-8 rounded-full mb-6 shadow-[0px_2px_10px_0px_rgba(79,70,229,0.10)]">
          <Plus className="w-12 h-12 text-theme-primary" />
        </div>
        <h3 className="text-xl font-semibold text-gray-950 mb-3">
          No widgets in this bucket yet
        </h3>
        <p className="text-gray-500 mb-8 max-w-md">
          Add your first widget to get started with this life bucket.
        </p>

        <Sheet open={isWidgetLibraryOpen} onOpenChange={setIsWidgetLibraryOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 bg-theme-primary hover:bg-theme-secondary text-white">
              <Plus className="w-4 h-4" />
              Add a Widget
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[520px] sm:w-[700px]">
            <SheetHeader>
              <SheetTitle className="text-gray-950">Widget Library</SheetTitle>
              <SheetDescription>
                Browse and add widgets to your dashboard
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <WidgetLibrary onAdd={() => {}} bucket="Health" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-violet-50 pl-20">
      {/* Header */}
      <div className="w-full h-16 left-0 top-0 absolute bg-white border-b border-gray-100">
        <div className="flex items-center h-full px-6">
          <div className="text-theme-primary text-xl font-medium tracking-tight">Lifeboard</div>
          <div className="text-gray-900 text-xl font-medium tracking-tight ml-0.5">AI</div>
          
          {/* Right side elements */}
          <div className="ml-auto flex items-center gap-4">
            <div className="flex gap-4">
              <Search className="w-5 h-5 text-gray-500" />
              <Bell className="w-5 h-5 text-gray-500" />
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </div>
            
            {/* User avatar */}
            <div className="w-8 h-8 ml-2 rounded-full bg-gray-200 overflow-hidden">
              <img className="w-full h-full object-cover" src="https://placehold.co/32x32" alt="User" />
            </div>
          </div>
        </div>
      </div>

      {/* Weather widget */}
      <div className="absolute right-6 top-6 flex items-center">
        <div className="text-gray-800 text-base font-medium leading-7">82°</div>
        <div className="text-gray-500 text-sm leading-tight ml-1">Austin</div>
      </div>

      {/* Sidebar */}
      <div className="w-20 left-0 top-0 bottom-0 fixed bg-white border-r border-gray-100 flex flex-col items-center py-8 gap-10">
        {/* Home - Active */}
        <div className="w-10 h-10 bg-theme-primary bg-opacity-10 rounded-lg flex items-center justify-center">
          <Home className="w-5 h-5 text-theme-primary" />
        </div>
        
        {/* User */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Document */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Calendar */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Search */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Settings */}
        <Link href="/dashboard/settings" className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100" title="Settings">
          <Settings className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* User Greeting */}
      <div className="absolute left-24 top-24">
        <div className="text-gray-800 text-sm font-medium">Hello {isLoading ? "there" : userName}</div>
        <div className="text-gray-600 text-xs mt-0.5">You've got this!</div>
      </div>
      
      {/* Main Content Box with Floating Tabs */}
      <div className="relative max-w-6xl mx-auto mt-32 mb-16">
        {/* Bucket Tabs - Now floating above content */}
        <div className="flex z-10 -mt-6">
          <div className="px-6 py-2 bg-theme-primary rounded-t-lg flex justify-center items-center">
            <div className="text-white text-xs font-semibold uppercase tracking-wide">{selectedBoard}</div>
          </div>
          <div className="w-8 h-8 flex justify-center items-center bg-white rounded-t-lg ml-1">
            <div className="text-theme-primary text-base font-bold">+</div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="bg-white rounded-tr-lg rounded-b-lg shadow-sm w-full">
          {/* Top Navigation */}
          <div className="flex items-center gap-8 px-8 pt-4 pb-3 border-b border-gray-100">
            <div className="text-theme-primary text-xs font-medium border-b-2 border-theme-primary pb-2">Overview</div>
            <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Trends</div>
            <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Logs</div>
            <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Settings</div>
          </div>
          
          {/* Content Area */}
          <div className="p-6 flex">
            {/* Left Content */}
            <div className="flex-1 pr-4">
              {selectedBoard === "Health" ? (
                <div>
                  {/* Health Metric Cards Row */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                      <div className="text-xs text-gray-500 uppercase mb-1">Weight</div>
                      <div className="flex items-baseline">
                        <span className="text-xl font-medium text-gray-900">150</span>
                        <span className="text-xs text-gray-500 ml-1">lbs</span>
                      </div>
                      <div className="ml-auto w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                        <BarChart2 className="w-3 h-3 text-amber-500" />
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                      <div className="text-xs text-gray-500 uppercase mb-1">Calories</div>
                      <div className="flex items-baseline">
                        <span className="text-xl font-medium text-gray-900">1,230</span>
                      </div>
                      <div className="ml-auto w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center">
                        <BarChart2 className="w-3 h-3 text-pink-500" />
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                      <div className="text-xs text-gray-500 uppercase mb-1">Steps</div>
                      <div className="flex items-baseline">
                        <span className="text-xl font-medium text-gray-900">15,138</span>
                      </div>
                      <div className="ml-auto w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <BarChart2 className="w-3 h-3 text-green-500" />
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                      <div className="text-xs text-gray-500 uppercase mb-1">Water</div>
                      <div className="flex items-baseline">
                        <span className="text-xl font-medium text-gray-900">40</span>
                        <span className="text-xs text-gray-500 ml-1">oz</span>
                      </div>
                      <div className="ml-auto w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <BarChart2 className="w-3 h-3 text-blue-500" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Weight Tabs */}
                  <div className="mb-4 border-b border-gray-100">
                    <div className="flex space-x-6">
                      <div className="text-theme-primary text-xs font-medium border-b-2 border-theme-primary pb-2">Weight</div>
                      <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Activity</div>
                      <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Nutrition</div>
                      <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Recovery</div>
                      <div className="text-theme-secondary text-xs font-medium hover:text-theme-primary cursor-pointer">Rest</div>
                    </div>
                  </div>
                  
                  {/* Chart Area */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">View</div>
                        <div className="text-sm font-medium text-gray-900 ml-2">4,783</div>
                        <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500">Yearly</span>
                        <svg className="w-4 h-4 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="h-48 w-full bg-indigo-50/50 rounded-lg relative">
                      {/* This would be the chart */}
                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-indigo-100/50 rounded-b-lg"></div>
                      <div className="absolute bottom-12 left-0 right-0 border-t border-dashed border-indigo-300/30"></div>
                      <div className="absolute bottom-24 left-0 right-0 border-t border-dashed border-indigo-300/30"></div>
                      <div className="absolute bottom-36 left-0 right-0 border-t border-dashed border-indigo-300/30"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-indigo-300">Weight trend chart</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyBucketState />
              )}
            </div>

            {/* Right Sidebar - Calendar & Tasks */}
            <div className="w-64 flex-shrink-0">
              {/* Calendar */}
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-900">{format(today, 'LLLL yyyy')}</h3>
                  <div className="flex space-x-1">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-gray-500">
                  <div>S</div>
                  <div>M</div>
                  <div>T</div>
                  <div>W</div>
                  <div>T</div>
                  <div>F</div>
                  <div>S</div>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekDays.map((d) => (
                    <div
                      key={d.toISOString()}
                      className={`text-xs py-1 rounded ${isSameDay(d, today) ? 'bg-theme-primary text-white' : 'text-gray-900'}`}
                    >
                      {format(d, 'd')}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Tasks */}
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Nov 13</h3>
                  <div className="text-xs text-gray-500">Today, Tuesday</div>
                </div>
                
                <div className="text-xs text-gray-500 mb-2">TO DO LIST</div>
                
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-4 h-4 rounded-full border border-theme-primary flex-shrink-0 mt-0.5"></div>
                    <div className="ml-2">
                      <div className="text-sm text-gray-900 font-medium">Create user flow</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-theme-primary inline-block"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="w-4 h-4 rounded-full border border-theme-primary flex-shrink-0 mt-0.5"></div>
                    <div className="ml-2">
                      <div className="text-sm text-gray-900 font-medium">Create onboarding pages</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-theme-primary inline-block"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="w-4 h-4 rounded-full border border-theme-primary flex-shrink-0 mt-0.5"></div>
                    <div className="ml-2">
                      <div className="text-sm text-gray-900 font-medium">Discuss about UX issue with Nik</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-theme-primary inline-block"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Box */}
      <div className="absolute left-36 right-6 bottom-4 px-4 py-3 bg-white rounded-2xl shadow-[0px_2px_10px_0px_rgba(58,53,65,0.06)] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-1.5 bg-theme-primary rounded-[10px] flex justify-center items-center gap-2">
            <div className="w-5 h-5 text-white">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-theme-primary text-base font-medium font-['Circular_Std'] leading-normal">|</span>
            <span className="text-gray-500 text-base font-medium font-['Circular_Std'] leading-normal">Ask me anything</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl">
            <Search className="w-6 h-6 text-theme-primary" />
          </div>
          <div className="p-2 rounded-xl">
            <Filter className="w-6 h-6 text-theme-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
