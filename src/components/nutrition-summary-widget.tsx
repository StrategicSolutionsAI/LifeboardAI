import React from 'react'
import { Utensils, Coffee, Sun, Moon, Cookie, Apple } from 'lucide-react'
import { useNutritionTracker } from '@/hooks/use-nutrition-tracker'

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
  bucketColor?: string
}

export function NutritionSummaryWidget({
  className,
  onClick,
  variant = 'card',
  showControls = true,
  compact = false,
  bucketColor
}: NutritionSummaryWidgetProps) {
  const { 
    dailyMeals, 
    nutritionGoals, 
    dailyTotals, 
    isLoading 
  } = useNutritionTracker()


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
              <span className="text-lg font-bold text-[#314158]">
                {Math.round(dailyTotals.calories)}
              </span>
              <span className="text-sm text-[#8e99a8]">/ {nutritionGoals.calories} cal</span>
            </div>
            {calorieProgress < 25 && (
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: bucketColor || '#B1916A' }}
              >
                Low
              </span>
            )}
          </div>
          <div className="w-full bg-[#f5f0eb] rounded-full h-1">
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(calorieProgress, 100)}%`, backgroundColor: bucketColor || '#B1916A' }}
            />
          </div>
          {mealsWithFood.length > 0 && (
            <div className="text-xs text-[#8e99a8]">
              {mealsWithFood.length} meal{mealsWithFood.length !== 1 ? 's' : ''} logged
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-48 rounded-xl border border-[#dbd6cf] bg-white p-4 shadow-sm relative animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-9 h-9 rounded-lg shadow-sm"
            style={{ backgroundColor: bucketColor ? `${bucketColor}e6` : 'rgba(72,184,130,0.9)' }}
          >
            <Utensils className="h-5 w-5 text-white m-2" />
          </div>
          <span className="text-sm font-medium truncate">Daily Nutrition</span>
        </div>
        <div className="w-20 h-8 bg-[#ebe5de] rounded mb-2 mt-1"></div>
        <div className="w-full h-1 bg-[#f5f0eb] rounded"></div>
      </div>
    )
  }

  return (
    <div 
      className="w-48 rounded-xl border border-[#dbd6cf] bg-white p-4 shadow-sm relative cursor-pointer hover:bg-[#faf8f5] hover:shadow-warm transition-all"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm"
          style={{ backgroundColor: bucketColor ? `${bucketColor}e6` : 'rgba(72,184,130,0.9)' }}
        >
          <Utensils className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-medium truncate">Daily Nutrition</span>
      </div>
      
      <div className="mt-2 mb-1">
        <span className="text-3xl font-black text-[#314158]">
          {Math.round(dailyTotals.calories)}
        </span>
        <span className="text-sm text-[#8e99a8]">
          {" "}/ {nutritionGoals.calories}
        </span>
        {calorieProgress < 25 && (
          <span
            className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: bucketColor || '#B1916A' }}
          >
            Low
          </span>
        )}
      </div>

      <div className="w-full bg-[#f5f0eb] rounded-full h-1 mt-2">
        <div
          className="h-1 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(calorieProgress, 100)}%`, backgroundColor: bucketColor || '#B1916A' }}
        />
      </div>
    </div>
  )
}
