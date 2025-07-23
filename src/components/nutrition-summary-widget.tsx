import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Apple, Coffee, Sun, Moon, Cookie } from 'lucide-react'

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
}

export function NutritionSummaryWidget({ className, onClick }: NutritionSummaryWidgetProps) {
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
      const today = new Date().toISOString().split('T')[0]
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

  if (loading) {
    return (
      <Card className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${className}`} onClick={onClick}>
        <div className="text-xs text-gray-500">Loading...</div>
      </Card>
    )
  }

  return (
    <Card className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${className}`} onClick={onClick}>
      <div className="space-y-2 mb-3">
        {mealsWithFood.length === 0 ? (
          <div className="text-xs text-gray-500">No meals logged today</div>
        ) : (
          mealsWithFood.map(([mealType, foods]) => {
            const mealNutrition = calculateMealNutrition(foods)
            return (
              <div key={mealType} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {getMealIcon(mealType)}
                  <span className="text-gray-600">
                    {getMealDisplayName(mealType)} ({foods.length} item{foods.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <span className="font-medium text-gray-800">
                  {Math.round(mealNutrition.calories)} cal
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t pt-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Calories</span>
          <span className="font-semibold">
            {Math.round(dailyTotals.calories)} / {nutritionGoals.calories}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              calorieProgress < 50 ? 'bg-red-500' : 
              calorieProgress < 80 ? 'bg-yellow-500' : 
              calorieProgress <= 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(calorieProgress, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {Math.round(calorieProgress)}% of daily goal
        </div>
      </div>
    </Card>
  )
}
