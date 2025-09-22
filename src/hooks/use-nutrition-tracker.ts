'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useDataCache } from '@/hooks/use-data-cache'

// Types
interface FatSecretServing {
  calories: string
  protein: string
  carbohydrate: string
  fat: string
  serving_description: string
  serving_id: string
  [key: string]: any
}

interface MealFood {
  id: string
  food_name: string
  serving: FatSecretServing
  quantity: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
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

interface FavoriteFood {
  id: string
  food_name: string
  serving: FatSecretServing
  added_count: number
  last_added: string
}

export function useNutritionTracker() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Cache-enabled data fetching with correct API
  const mealsCache = useDataCache<DailyMeals>(
    'nutrition-meals',
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/nutrition/meals?date=${today}`)
      if (!response.ok) throw new Error('Failed to load meals')
      return response.json()
    },
    { ttl: 5 * 60 * 1000, prefetch: true }
  )

  const goalsCache = useDataCache<NutritionGoals>(
    'nutrition-goals',
    async () => {
      const response = await fetch('/api/nutrition/goals')
      if (!response.ok) throw new Error('Failed to load goals')
      return response.json()
    },
    { ttl: 30 * 60 * 1000, prefetch: true }
  )

  const favoritesCache = useDataCache<FavoriteFood[]>(
    'nutrition-favorites',
    async () => {
      const response = await fetch('/api/nutrition/favorites')
      if (!response.ok) throw new Error('Failed to load favorites')
      return response.json()
    },
    { ttl: 15 * 60 * 1000, prefetch: true }
  )

  // Extract data with defaults
  const dailyMeals = useMemo(() =>
    mealsCache.data || { breakfast: [], lunch: [], dinner: [], snacks: [] },
    [mealsCache.data]
  )
  const nutritionGoals = useMemo(() =>
    goalsCache.data || { calories: 2000, protein: 150, carbs: 250, fat: 65 },
    [goalsCache.data]
  )
  const favoriteFoods = favoritesCache.data || []

  // Memoized calculations
  const dailyTotals = useMemo(() => {
    const allFoods = Object.values(dailyMeals).flat()
    return allFoods.reduce((totals, food) => {
      const calories = parseFloat(food.serving.calories || '0') * food.quantity
      const protein = parseFloat(food.serving.protein || '0') * food.quantity
      const carbs = parseFloat(food.serving.carbohydrate || '0') * food.quantity
      const fat = parseFloat(food.serving.fat || '0') * food.quantity

      return {
        calories: totals.calories + calories,
        protein: totals.protein + protein,
        carbs: totals.carbs + carbs,
        fat: totals.fat + fat
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }, [dailyMeals])

  const progressPercentages = useMemo(() => ({
    calories: Math.min((dailyTotals.calories / nutritionGoals.calories) * 100, 100),
    protein: Math.min((dailyTotals.protein / nutritionGoals.protein) * 100, 100),
    carbs: Math.min((dailyTotals.carbs / nutritionGoals.carbs) * 100, 100),
    fat: Math.min((dailyTotals.fat / nutritionGoals.fat) * 100, 100)
  }), [dailyTotals, nutritionGoals])

  // API functions
  const addFoodToMeal = useCallback(async (
    foodId: string,
    foodName: string,
    serving: FatSecretServing,
    quantity: number,
    mealType: keyof DailyMeals
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/nutrition/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_id: foodId,
          food_name: foodName,
          serving,
          quantity,
          meal_type: mealType
        })
      })

      if (!response.ok) throw new Error('Failed to add meal')

      const newMeal = await response.json()
      
      // Optimistic update
      mealsCache.updateOptimistically((current: DailyMeals | null) => {
        const meals = current || { breakfast: [], lunch: [], dinner: [], snacks: [] }
        return {
          ...meals,
          [mealType]: [...meals[mealType], newMeal]
        }
      })

      // Update favorites
      await updateFavoriteFood(foodId, foodName, serving)

      // Emit event to update other nutrition components immediately
      window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))

      return newMeal
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add food'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [mealsCache])

  const removeFoodFromMeal = useCallback(async (mealType: keyof DailyMeals, foodId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/nutrition/meals?id=${foodId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove meal')

      // Optimistic update
      mealsCache.updateOptimistically((current: DailyMeals | null) => {
        const meals = current || { breakfast: [], lunch: [], dinner: [], snacks: [] }
        return {
          ...meals,
          [mealType]: meals[mealType].filter((food: MealFood) => food.id !== foodId)
        }
      })

      // Emit event to update other nutrition components immediately
      window.dispatchEvent(new CustomEvent('nutritionDataUpdated'))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove food'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [mealsCache])

  const updateFavoriteFood = useCallback(async (foodId: string, foodName: string, serving: FatSecretServing) => {
    try {
      const response = await fetch('/api/nutrition/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_id: foodId,
          food_name: foodName,
          serving
        })
      })

      if (response.ok) {
        // Invalidate favorites cache
        favoritesCache.invalidate()
      }
    } catch (error) {
      console.error('Error updating favorite food:', error)
    }
  }, [favoritesCache])

  const saveNutritionGoals = useCallback(async (goals: NutritionGoals) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/nutrition/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goals)
      })

      if (!response.ok) throw new Error('Failed to save goals')

      const savedGoals = await response.json()
      
      // Update cache
      goalsCache.updateOptimistically(() => savedGoals)
      
      return savedGoals
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save goals'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [goalsCache])

  const quickAddFavorite = useCallback(async (favorite: FavoriteFood, mealType: keyof DailyMeals) => {
    return addFoodToMeal(favorite.id, favorite.food_name, favorite.serving, 1, mealType)
  }, [addFoodToMeal])

  const getMealNutrition = useCallback((mealType: keyof DailyMeals) => {
    const foods = dailyMeals[mealType]
    return foods.reduce((totals, food) => {
      const calories = parseFloat(food.serving.calories || '0') * food.quantity
      const protein = parseFloat(food.serving.protein || '0') * food.quantity
      const carbs = parseFloat(food.serving.carbohydrate || '0') * food.quantity
      const fat = parseFloat(food.serving.fat || '0') * food.quantity

      return {
        calories: totals.calories + calories,
        protein: totals.protein + protein,
        carbs: totals.carbs + carbs,
        fat: totals.fat + fat
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }, [dailyMeals])

  const clearError = useCallback(() => setError(null), [])

  // Listen for external data updates (e.g., when panel closes)
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('🔄 Nutrition data updated - refetching caches')
      // Force refetch instead of just invalidating
      mealsCache.refetch()
      goalsCache.refetch()
      favoritesCache.refetch()
    }

    window.addEventListener('nutritionDataUpdated', handleDataUpdate)
    return () => window.removeEventListener('nutritionDataUpdated', handleDataUpdate)
  }, [mealsCache, goalsCache, favoritesCache])

  return {
    // Data
    dailyMeals,
    nutritionGoals,
    favoriteFoods,
    dailyTotals,
    progressPercentages,
    
    // Loading states
    isLoading: isLoading || mealsCache.loading,
    error,
    
    // Actions
    addFoodToMeal,
    removeFoodFromMeal,
    updateFavoriteFood,
    saveNutritionGoals,
    quickAddFavorite,
    getMealNutrition,
    clearError
  }
}
