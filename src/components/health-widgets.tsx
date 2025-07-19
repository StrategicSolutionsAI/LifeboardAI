"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Plus, Droplets, Flame, Target, Scale, TrendingUp, Activity, BarChart } from "lucide-react"
import { WidgetLibrary } from "./widget-library"
import { WithingsWeightWidget } from "./withings-weight-widget"

interface HealthMetric {
  id: string
  title: string
  value: string
  unit: string
  icon: any
  color: string
  bgColor: string
}

export function HealthWidgets() {
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false)
  
  const healthMetrics: HealthMetric[] = [
    {
      id: "weight",
      title: "WEIGHT",
      value: "150",
      unit: "lbs",
      icon: Scale,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      id: "calories",
      title: "CALORIES",
      value: "1,230",
      unit: "",
      icon: Flame,
      color: "text-pink-600",
      bgColor: "bg-pink-100"
    },
    {
      id: "steps",
      title: "STEPS",
      value: "15,138",
      unit: "",
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      id: "water",
      title: "WATER",
      value: "40",
      unit: "oz",
      icon: Droplets,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    }
  ]

  const subTabs = [
    { id: "weight", name: "Weight", active: true },
    { id: "activity", name: "Activity", active: false },
    { id: "nutrition", name: "Nutrition", active: false },
    { id: "recovery", name: "Recovery", active: false },
    { id: "rest", name: "Rest", active: false },
  ]

  return (
    <div className="space-y-6">
      {/* Health Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {healthMetrics.map((metric) => {
          const Icon = metric.icon
          
          // Use Withings widget for weight metric
          if (metric.id === 'weight') {
            return (
              <WithingsWeightWidget
                key={metric.id}
                className="col-span-1"
                showControls={false}
                unit="lbs"
                goalWeight={145}
                startingWeight={155}
              />
            )
          }
          
          return (
            <Card key={metric.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">{metric.title}</p>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-lg font-semibold text-gray-900">{metric.value}</span>
                    {metric.unit && <span className="text-xs text-gray-500">{metric.unit}</span>}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Sub Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab.active
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Chart Area */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">View</span>
              <span className="text-sm font-medium text-gray-900">4,783</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <select aria-label="Time range" className="text-sm text-gray-600 border-none bg-transparent">
              <option>Yearly</option>
              <option>Monthly</option>
              <option>Weekly</option>
            </select>
          </div>

          {/* Chart Placeholder */}
          <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Simulated Chart Background */}
            <div className="absolute inset-0">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                {/* Grid Lines */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
                {/* Chart Line */}
                <path
                  d="M 40 160 Q 80 140 120 120 T 200 100 T 280 80 Q 320 70 360 60"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                
                {/* Area under curve */}
                <path
                  d="M 40 160 Q 80 140 120 120 T 200 100 T 280 80 Q 320 70 360 60 L 360 200 L 40 200 Z"
                  fill="url(#blueGradient)"
                  opacity="0.2"
                />
                
                <defs>
                  <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#3b82f6", stopOpacity:0.4}} />
                    <stop offset="100%" style={{stopColor:"#3b82f6", stopOpacity:0.1}} />
                  </linearGradient>
                </defs>

                {/* Data Point */}
                <circle cx="200" cy="100" r="4" fill="#3b82f6" />
                <circle cx="200" cy="100" r="8" fill="#3b82f6" opacity="0.2" />
              </svg>
            </div>

            {/* Month Labels */}
            <div className="absolute bottom-4 left-6 right-6 flex justify-between text-xs text-gray-400">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
              <span>Dec</span>
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between text-xs text-gray-400">
              <span>10k</span>
              <span>8k</span>
              <span>6k</span>
              <span>4k</span>
              <span>2k</span>
              <span>0k</span>
            </div>
          </div>

          {/* Chart Stats */}
          <div className="grid grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">STARTING WEIGHT</p>
              <p className="text-sm font-semibold text-gray-900">155 lbs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">CURRENT WEIGHT</p>
              <p className="text-sm font-semibold text-gray-900">150 lbs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">GOAL WEIGHT</p>
              <p className="text-sm font-semibold text-gray-900">145 lbs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">WEIGHT LOSS</p>
              <p className="text-sm font-semibold text-gray-900">-5 lbs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">GOAL DATE</p>
              <p className="text-sm font-semibold text-gray-900">February 3, 2024</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat/Input Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            AI
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-500">
            Ask me anything
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            ADD TASK
          </Button>
        </div>
      </div>

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
        <SheetContent className="w-[520px] sm:w-[700px]">
          <SheetHeader>
            <SheetTitle>Widget Library</SheetTitle>
            <SheetDescription>
              Add widgets to track your health goals and habits
            </SheetDescription>
          </SheetHeader>
          <WidgetLibrary />
        </SheetContent>
      </Sheet>
    </div>
  )
}
