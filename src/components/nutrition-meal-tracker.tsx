'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Apple, Utensils, Plus, Trash2, Coffee, Sun, Moon, Cookie, Target, Settings, Star, Heart } from 'lucide-react'
import { FatSecretFood, FatSecretSearchResponse, FatSecretFoodDetail } from '@/lib/fatsecret/client'

interface FatSecretServing {
  calcium?: string
  calories: string
  carbohydrate: string
  cholesterol?: string
  fat: string
  fiber?: string
  iron?: string
  measurement_description: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  monounsaturated_fat?: string
  number_of_units?: string
  polyunsaturated_fat?: string
  potassium?: string
  protein: string
  saturated_fat?: string
  serving_description: string
  serving_id: string
  serving_url: string
  sodium?: string
  sugar?: string
  vitamin_a?: string
  vitamin_c?: string
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

interface NutritionMealTrackerProps {
  className?: string
}

const MEAL_ICONS = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snacks: Cookie
}

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch', 
  dinner: 'Dinner',
  snacks: 'Snacks'
}

export function NutritionMealTracker({ className }: NutritionMealTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FatSecretFood[]>([])
  const [selectedFood, setSelectedFood] = useState<FatSecretFoodDetail | null>(null)
  const [selectedServing, setSelectedServing] = useState<FatSecretServing | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snacks'>('breakfast')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const [favoriteFoods, setFavoriteFoods] = useState<FavoriteFood[]>([])
  const [currentView, setCurrentView] = useState<'search' | 'meals' | 'goals'>('meals')
  const [showFavorites, setShowFavorites] = useState(false)

  // Load data from API on component mount
  useEffect(() => {
    loadMeals()
    loadNutritionGoals()
    loadFavoriteFoods()
  }, [])
  
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
  
  const loadFavoriteFoods = async () => {
    try {
      const response = await fetch('/api/nutrition/favorites')
      if (response.ok) {
        const favorites = await response.json()
        setFavoriteFoods(favorites)
      }
    } catch (error) {
      console.error('Failed to load favorite foods:', error)
    }
  }

  // No longer need localStorage persistence - data is saved via API calls
  
  // Auto-search with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    const timeoutId = setTimeout(() => {
      searchFoods(searchQuery)
    }, 500) // 500ms delay
    
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const searchFoods = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const response = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(query)}&max_results=10`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to search foods')
      }

      const data: FatSecretSearchResponse = await response.json()
      setSearchResults(data.foods?.food || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const getFoodDetails = async (foodId: string) => {
    setIsLoadingDetails(true)
    setError(null)

    try {
      const response = await fetch(`/api/fatsecret/food?food_id=${foodId}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get food details')
      }

      const data: FatSecretFoodDetail = await response.json()
      setSelectedFood(data)
      // Auto-select first serving
      if (data.food.servings?.serving?.length > 0) {
        setSelectedServing(data.food.servings.serving[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load food details')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchFoods(searchQuery)
  }

  const updateFavoriteFood = async (foodId: string, foodName: string, serving: FatSecretServing) => {
    try {
      const response = await fetch('/api/nutrition/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_id: foodId,
          food_name: foodName,
          serving
        })
      })

      if (response.ok) {
        // Reload favorites from API to get updated data
        await loadFavoriteFoods()
      } else {
        console.error('Failed to update favorite food')
      }
    } catch (error) {
      console.error('Error updating favorite food:', error)
    }
  }

  const saveNutritionGoals = async (goals: NutritionGoals) => {
    try {
      const response = await fetch('/api/nutrition/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(goals)
      })

      if (response.ok) {
        const savedGoals = await response.json()
        setNutritionGoals(savedGoals)
      } else {
        console.error('Failed to save nutrition goals')
      }
    } catch (error) {
      console.error('Error saving nutrition goals:', error)
    }
  }

  const addFoodToMeal = async () => {
    if (!selectedFood || !selectedServing) return

    try {
      // Add meal to database
      const response = await fetch('/api/nutrition/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          food_id: selectedFood.food.food_id,
          food_name: selectedFood.food.food_name,
          serving: selectedServing,
          quantity,
          meal_type: selectedMeal
        })
      })

      if (response.ok) {
        const newMeal = await response.json()
        
        // Update local state
        setDailyMeals(prev => ({
          ...prev,
          [selectedMeal]: [...prev[selectedMeal], newMeal]
        }))

        // Update favorite food
        await updateFavoriteFood(selectedFood.food.food_id, selectedFood.food.food_name, selectedServing)

        // Reset form
        setSelectedFood(null)
        setSelectedServing(null)
        setQuantity(1)
        setSearchQuery('')
        setSearchResults([])
        setCurrentView('meals')
      } else {
        console.error('Failed to add meal')
      }
    } catch (error) {
      console.error('Error adding meal:', error)
    }
  }

  const removeFoodFromMeal = async (mealType: keyof DailyMeals, foodId: string) => {
    try {
      const response = await fetch(`/api/nutrition/meals?id=${foodId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDailyMeals(prev => ({
          ...prev,
          [mealType]: prev[mealType].filter(food => food.id !== foodId)
        }))
      } else {
        console.error('Failed to remove meal')
      }
    } catch (error) {
      console.error('Error removing meal:', error)
    }
  }

  const calculateMealNutrition = (foods: MealFood[]) => {
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

  const calculateProgress = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100)
  }

  const getProgressColor = (progress: number) => {
    if (progress < 50) return 'bg-red-500'
    if (progress < 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formatNutrientValue = (value: string | undefined, unit = 'g') => {
    if (!value) return 'N/A'
    const num = parseFloat(value)
    return isNaN(num) ? 'N/A' : `${num}${unit}`
  }

  const dailyTotals = calculateDailyTotals()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="h-5 w-5" />
          Daily Nutrition Tracker
        </CardTitle>
        <CardDescription>
          Track your daily meals and nutrition intake
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={currentView === 'meals' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView('meals')}
          >
            <Utensils className="h-4 w-4 mr-1" />
            My Meals
          </Button>
          <Button
            variant={currentView === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView('search')}
          >
            <Search className="h-4 w-4 mr-1" />
            Add Food
          </Button>
          <Button
            variant={currentView === 'goals' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView('goals')}
          >
            <Target className="h-4 w-4 mr-1" />
            Goals
          </Button>
        </div>

        {/* Daily Totals Summary */}
        {currentView === 'meals' && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Today's Progress</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('goals')}
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Edit Goals
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Calories */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">Calories</span>
                  <span className="text-xs">{Math.round(dailyTotals.calories)}/{nutritionGoals.calories}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(calculateProgress(dailyTotals.calories, nutritionGoals.calories))}`}
                    style={{ width: `${calculateProgress(dailyTotals.calories, nutritionGoals.calories)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Protein */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">Protein</span>
                  <span className="text-xs">{Math.round(dailyTotals.protein)}g/{nutritionGoals.protein}g</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(calculateProgress(dailyTotals.protein, nutritionGoals.protein))}`}
                    style={{ width: `${calculateProgress(dailyTotals.protein, nutritionGoals.protein)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Carbs */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">Carbs</span>
                  <span className="text-xs">{Math.round(dailyTotals.carbs)}g/{nutritionGoals.carbs}g</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(calculateProgress(dailyTotals.carbs, nutritionGoals.carbs))}`}
                    style={{ width: `${calculateProgress(dailyTotals.carbs, nutritionGoals.carbs)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Fat */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">Fat</span>
                  <span className="text-xs">{Math.round(dailyTotals.fat)}g/{nutritionGoals.fat}g</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(calculateProgress(dailyTotals.fat, nutritionGoals.fat))}`}
                    style={{ width: `${calculateProgress(dailyTotals.fat, nutritionGoals.fat)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Meals View */}
        {currentView === 'meals' && (
          <div className="space-y-4">
            {Object.entries(dailyMeals).map(([mealType, foods]) => {
              const MealIcon = MEAL_ICONS[mealType as keyof typeof MEAL_ICONS]
              const mealNutrition = calculateMealNutrition(foods)
              
              return (
                <div key={mealType} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MealIcon className="h-4 w-4" />
                      <h4 className="font-medium">{MEAL_LABELS[mealType as keyof typeof MEAL_LABELS]}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(mealNutrition.calories)} cal
                      </Badge>
                    </div>
                  </div>

                  {foods.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No foods added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {foods.map((food: MealFood) => (
                        <div key={food.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{food.food_name}</div>
                            <div className="text-xs text-gray-600">
                              {food.quantity}x {food.serving.serving_description} • {Math.round(parseFloat(food.serving.calories || '0') * food.quantity)} cal
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFoodFromMeal(mealType as keyof DailyMeals, food.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Goals View */}
        {currentView === 'goals' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Nutrition Goals
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Daily Calories</label>
                  <Input
                    type="number"
                    value={nutritionGoals.calories}
                    onChange={(e) => setNutritionGoals(prev => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Protein (g)</label>
                  <Input
                    type="number"
                    value={nutritionGoals.protein}
                    onChange={(e) => setNutritionGoals(prev => ({ ...prev, protein: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Carbs (g)</label>
                  <Input
                    type="number"
                    value={nutritionGoals.carbs}
                    onChange={(e) => setNutritionGoals(prev => ({ ...prev, carbs: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fat (g)</label>
                  <Input
                    type="number"
                    value={nutritionGoals.fat}
                    onChange={(e) => setNutritionGoals(prev => ({ ...prev, fat: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => saveNutritionGoals(nutritionGoals)}
                  size="sm"
                >
                  Save Goals
                </Button>
              </div>
              
              <div className="mt-4 p-3 bg-white rounded border">
                <h5 className="font-medium text-sm mb-2">Goal Presets</h5>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveNutritionGoals({ calories: 1500, protein: 120, carbs: 150, fat: 50 })}
                  >
                    Weight Loss
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveNutritionGoals({ calories: 2000, protein: 150, carbs: 250, fat: 65 })}
                  >
                    Maintenance
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveNutritionGoals({ calories: 2500, protein: 180, carbs: 300, fat: 85 })}
                  >
                    Muscle Gain
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Favorite Foods */}
            {favoriteFoods.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Favorite Foods
                </h4>
                <div className="space-y-2">
                  {favoriteFoods.slice(0, 5).map((favorite) => (
                    <div key={favorite.id} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{favorite.food_name}</div>
                        <div className="text-xs text-gray-600">
                          {favorite.serving.serving_description} • Added {favorite.added_count} times
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Quick add to current meal
                          const mealFood: MealFood = {
                            id: `${favorite.id}-${Date.now()}`,
                            food_name: favorite.food_name,
                            serving: favorite.serving,
                            quantity: 1,
                            meal_type: selectedMeal,
                            added_at: new Date().toISOString()
                          }
                          setDailyMeals(prev => ({
                            ...prev,
                            [selectedMeal]: [...prev[selectedMeal], mealFood]
                          }))
                          setCurrentView('meals')
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search View */}
        {currentView === 'search' && (
          <div className="space-y-4">
            {/* Quick Access Toggle */}
            {favoriteFoods.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant={!showFavorites ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFavorites(false)}
                >
                  <Search className="h-4 w-4 mr-1" />
                  Search Foods
                </Button>
                <Button
                  variant={showFavorites ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFavorites(true)}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Quick Add ({favoriteFoods.length})
                </Button>
              </div>
            )}
            
            {/* Favorites Quick Add */}
            {showFavorites && favoriteFoods.length > 0 && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Quick Add Favorites</h4>
                <div className="space-y-2">
                  {favoriteFoods.map((favorite) => (
                    <div key={favorite.id} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{favorite.food_name}</div>
                        <div className="text-xs text-gray-600">
                          {favorite.serving.serving_description} • {favorite.serving.calories} cal
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedMeal}
                          onChange={(e) => setSelectedMeal(e.target.value as any)}
                          className="text-xs p-1 border rounded"
                        >
                          <option value="breakfast">Breakfast</option>
                          <option value="lunch">Lunch</option>
                          <option value="dinner">Dinner</option>
                          <option value="snacks">Snacks</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const mealFood: MealFood = {
                              id: `${favorite.id}-${Date.now()}`,
                              food_name: favorite.food_name,
                              serving: favorite.serving,
                              quantity: 1,
                              meal_type: selectedMeal,
                              added_at: new Date().toISOString()
                            }
                            setDailyMeals(prev => ({
                              ...prev,
                              [selectedMeal]: [...prev[selectedMeal], mealFood]
                            }))
                            setCurrentView('meals')
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search Form */}
            {!showFavorites && (
              <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search for foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>
            )}

            {!showFavorites && error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {/* Search Results */}
            {!showFavorites && searchResults.length > 0 && !selectedFood && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Search Results:</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((food) => (
                    <div
                      key={food.food_id}
                      className="p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => getFoodDetails(food.food_id)}
                    >
                      <div className="font-medium text-sm">{food.food_name}</div>
                      {food.brand_name && (
                        <div className="text-xs text-gray-500">{food.brand_name}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {food.food_description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Details */}
            {!showFavorites && isLoadingDetails && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm">Loading nutrition details...</span>
              </div>
            )}

            {/* Food Details & Add to Meal */}
            {!showFavorites && selectedFood && !isLoadingDetails && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{selectedFood.food.food_name}</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFood(null)
                      setSelectedServing(null)
                    }}
                  >
                    Back to Search
                  </Button>
                </div>

                {/* Serving Selection */}
                {selectedFood.food.servings?.serving?.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Select Serving Size:</h5>
                    <div className="space-y-2">
                      {selectedFood.food.servings.serving.slice(0, 3).map((serving, index) => (
                        <div
                          key={serving.serving_id || index}
                          className={`border rounded p-3 cursor-pointer transition-colors ${
                            selectedServing?.serving_id === serving.serving_id
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedServing(serving)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Utensils className="h-4 w-4" />
                            <span className="font-medium text-sm">
                              {serving.serving_description}
                            </span>
                            {serving.metric_serving_amount && serving.metric_serving_unit && (
                              <Badge variant="secondary" className="text-xs">
                                {serving.metric_serving_amount} {serving.metric_serving_unit}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span>Calories:</span>
                              <span className="font-medium">{serving.calories}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Protein:</span>
                              <span className="font-medium">{formatNutrientValue(serving.protein)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Carbs:</span>
                              <span className="font-medium">{formatNutrientValue(serving.carbohydrate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fat:</span>
                              <span className="font-medium">{formatNutrientValue(serving.fat)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add to Meal Form */}
                    {selectedServing && (
                      <div className="bg-green-50 p-4 rounded-lg space-y-3">
                        <h5 className="font-medium text-sm">Add to Meal:</h5>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Meal</label>
                            <select
                              value={selectedMeal}
                              onChange={(e) => setSelectedMeal(e.target.value as any)}
                              className="w-full p-2 border rounded text-sm"
                            >
                              <option value="breakfast">Breakfast</option>
                              <option value="lunch">Lunch</option>
                              <option value="dinner">Dinner</option>
                              <option value="snacks">Snacks</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Quantity</label>
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={quantity}
                              onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          Total: {Math.round(parseFloat(selectedServing.calories || '0') * quantity)} calories
                        </div>

                        <Button onClick={addFoodToMeal} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add to {MEAL_LABELS[selectedMeal]}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!showFavorites && searchResults.length === 0 && !selectedFood && !isSearching && searchQuery && (
              <div className="text-center py-8 text-gray-500">
                <Apple className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No foods found for "{searchQuery}"</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}

            {/* Initial State */}
            {!showFavorites && !searchQuery && searchResults.length === 0 && !selectedFood && (
              <div className="text-center py-8 text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Search for any food to add to your meals</p>
                <p className="text-sm">Try searching for "apple", "chicken breast", or "oatmeal"</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
