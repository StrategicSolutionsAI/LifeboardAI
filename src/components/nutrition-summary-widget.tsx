import React, { useState, useEffect } from 'react'
import { Utensils, Coffee, Sun, Moon, Cookie } from 'lucide-react'
import { getCurrentLocalDate } from '@/lib/date-utils'

interface MealFood {
  id: string
  food_name: string
  serving: {
    calories?: string
    protein?: string
    carbohydrate?: string
    fat?: string
  }
  quantity: number
  meal_type: string
  added_at: string
}

interface DailyMeals {
  breakfast: MealFood[]
  lunch: MealFood[]
  dinner: MealFood[]
  snacks: MealFood[]
}

interface NutritionGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface NutritionSummaryWidgetProps {
  className?: string
  onClick?: () => void
  variant?: 'card' | 'embedded'
  showControls?: boolean
  compact?: boolean
}

export function NutritionSummaryWidget({ 
  className, 
  onClick, 
  variant = 'card', 
  showControls = true, 
  compact = false 
}: NutritionSummaryWidgetProps) {
  const [dailyMeals, setDailyMeals] = useState<DailyMeals>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  })
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([loadMeals(), loadNutritionGoals()])
    } catch (error) {
      console.error('Error loading nutrition data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMeals = async () => {
    try {
      const today = getCurrentLocalDate()
      const response = await fetch(`/api/nutrition/meals?date=${today}`)
      if (response.ok) {
        const meals = await response.json()
        setDailyMeals(meals)
      }
    } catch (error) {
      console.error('Failed to load meals:', error)
    }
  }

  const loadNutritionGoals = async () => {
    try {
      const response = await fetch('/api/nutrition/goals')
      if (response.ok) {
        const goals = await response.json()
        setNutritionGoals(goals)
      }
    } catch (error) {
      console.error('Failed to load nutrition goals:', error)
    }
  }

  const calculateMealNutrition = (foods: MealFood[]) => {
    return foods.reduce((totals, food) => {
      const calories = parseFloat(food.serving.calories || '0') * food.quantity
      return {
        calories: totals.calories + calories
      }
    }, { calories: 0 })
  }

  const calculateDailyTotals = () => {
    const allFoods = [
      ...dailyMeals.breakfast,
      ...dailyMeals.lunch,
      ...dailyMeals.dinner,
      ...dailyMeals.snacks
    ]
    return calculateMealNutrition(allFoods)
  }

  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return <Coffee className="h-3 w-3" />
      case 'lunch': return <Sun className="h-3 w-3" />
      case 'dinner': return <Moon className="h-3 w-3" />
      case 'snacks': return <Cookie className="h-3 w-3" />
      default: return <Apple className="h-3 w-3" />
    }
  }

  const getMealDisplayName = (mealType: string) => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1)
  }

  const dailyTotals = calculateDailyTotals()
  const calorieProgress = (dailyTotals.calories / nutritionGoals.calories) * 100

  const mealsWithFood = Object.entries(dailyMeals).filter(([_, foods]) => foods.length > 0)
  const remainingCalories = nutritionGoals.calories - dailyTotals.calories
  const isOverGoal = dailyTotals.calories > nutritionGoals.calories

  // Determine progress color based on calorie intake
  const getProgressColor = () => {
    if (calorieProgress < 25) return 'low'
    if (calorieProgress < 75) return 'medium' 
    if (calorieProgress <= 100) return 'high'
    return 'over'
  }

  // Determine status badge
  const getStatusBadge = () => {
    if (calorieProgress < 25) return { text: 'Low', variant: 'warning' as const }
    if (calorieProgress < 75) return { text: 'On Track', variant: 'info' as const }
    if (calorieProgress <= 100) return { text: 'Great', variant: 'success' as const }
    return { text: 'Over Goal', variant: 'neutral' as const }
  }

  // Handle embedded variant (for taskboard)
  if (variant === 'embedded') {
    return (
      <div className={`${className}`} onClick={onClick}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                {Math.round(dailyTotals.calories)}
              </span>
              <span className="text-sm text-gray-500">/ {nutritionGoals.calories} cal</span>
            </div>
            {calorieProgress < 25 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-500 text-white">
                Low
              </span>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div 
              className={`h-1 rounded-full transition-all duration-300 ${
                calorieProgress >= 100 ? "bg-blue-500" : 
                calorieProgress >= 75 ? "bg-green-500" : 
                calorieProgress >= 25 ? "bg-yellow-500" : "bg-gray-300"
              }`}
              style={{ width: `${Math.min(calorieProgress, 100)}%` }}
            />
          </div>
          {mealsWithFood.length > 0 && (
            <div className="text-xs text-gray-500">
              {mealsWithFood.length} meal{mealsWithFood.length !== 1 ? 's' : ''} logged
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm relative animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-green-500/90 shadow-sm">
            <Utensils className="h-5 w-5 text-white m-2" />
          </div>
          <span className="text-sm font-medium truncate">Daily Nutrition</span>
        </div>
        <div className="w-20 h-8 bg-gray-200 rounded mb-2 mt-1"></div>
        <div className="w-full h-1 bg-gray-100 rounded"></div>
      </div>
    )
  }

  return (
    <div 
      className="w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm relative cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/90 shadow-sm">
          <Utensils className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-medium truncate">Daily Nutrition</span>
      </div>
      
      <div className="mt-2 mb-1">
        <span className="text-3xl font-black text-gray-900">
          {Math.round(dailyTotals.calories)}
        </span>
        <span className="text-sm text-gray-500">
          {" "}/ {nutritionGoals.calories}
        </span>
        {calorieProgress < 25 && (
          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-500 text-white">
            Low
          </span>
        )}
      </div>
      
      <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
        <div 
          className={`h-1 rounded-full transition-all duration-300 ${
            calorieProgress >= 100 ? "bg-blue-500" : 
            calorieProgress >= 75 ? "bg-green-500" : 
            calorieProgress >= 25 ? "bg-yellow-500" : "bg-gray-300"
          }`}
          style={{ width: `${Math.min(calorieProgress, 100)}%` }}
        />
      </div>
    </div>
  )
}
