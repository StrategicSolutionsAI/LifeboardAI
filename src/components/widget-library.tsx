"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Droplets, 
  Flame, 
  Target, 
  Scale, 
  Heart, 
  Moon, 
  Activity,
  Coffee,
  Search,
  Filter
} from "lucide-react"

interface WidgetTemplate {
  id: string
  name: string
  description: string
  icon: any
  category: string
  color: string
  defaultTarget: number
  unit: string
}

const widgetTemplates: WidgetTemplate[] = [
  {
    id: "water",
    name: "Water Intake",
    description: "Track daily water consumption",
    icon: Droplets,
    category: "health",
    color: "blue",
    defaultTarget: 8,
    unit: "cups"
  },
  {
    id: "calories",
    name: "Calories Burned", 
    description: "Monitor daily calorie expenditure",
    icon: Flame,
    category: "health",
    color: "orange",
    defaultTarget: 2500,
    unit: "cal"
  },
  {
    id: "steps",
    name: "Daily Steps",
    description: "Count your steps throughout the day",
    icon: Target,
    category: "health", 
    color: "green",
    defaultTarget: 10000,
    unit: "steps"
  },
  {
    id: "weight",
    name: "Weight Tracking",
    description: "Monitor weight changes over time",
    icon: Scale,
    category: "health",
    color: "purple",
    defaultTarget: 150,
    unit: "lbs"
  },
  {
    id: "heartrate",
    name: "Heart Rate",
    description: "Track resting heart rate",
    icon: Heart,
    category: "health",
    color: "red",
    defaultTarget: 70,
    unit: "bpm"
  },
  {
    id: "sleep",
    name: "Sleep Duration",
    description: "Monitor nightly sleep hours",
    icon: Moon,
    category: "health",
    color: "indigo",
    defaultTarget: 8,
    unit: "hours"
  },
  {
    id: "exercise",
    name: "Exercise Minutes",
    description: "Track daily exercise time",
    icon: Activity,
    category: "health",
    color: "green",
    defaultTarget: 30,
    unit: "min"
  },
  {
    id: "caffeine",
    name: "Caffeine Intake",
    description: "Monitor daily caffeine consumption",
    icon: Coffee,
    category: "health",
    color: "amber",
    defaultTarget: 2,
    unit: "cups"
  }
]

const categories = [
  { id: "all", name: "All" },
  { id: "health", name: "Health" },
  { id: "fitness", name: "Fitness" },
  { id: "nutrition", name: "Nutrition" }
]

export function WidgetLibrary() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filteredWidgets = widgetTemplates.filter(widget => {
    const matchesSearch = widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || widget.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const addWidget = (widget: WidgetTemplate) => {
    // In a real app, this would add the widget to the user's dashboard
    console.log("Adding widget:", widget)
    // Show success toast notification
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search widgets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className="text-xs"
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {filteredWidgets.map((widget) => {
          const Icon = widget.icon
          return (
            <Card key={widget.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg bg-${widget.color}-500 flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{widget.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Target: {widget.defaultTarget} {widget.unit}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => addWidget(widget)}
                    className="text-xs px-3 py-1"
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredWidgets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No widgets found matching your criteria</p>
        </div>
      )}
    </div>
  )
}
