'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Apple, Utensils, TrendingUp } from 'lucide-react'
import { FatSecretFood, FatSecretSearchResponse, FatSecretFoodDetail } from '@/lib/fatsecret/client'

interface NutritionWidgetProps {
  className?: string
}

export function FatSecretNutritionWidget({ className }: NutritionWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FatSecretFood[]>([])
  const [selectedFood, setSelectedFood] = useState<FatSecretFoodDetail | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchFoods = async (query: string) => {
    if (!query.trim()) return

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

  const formatNutrientValue = (value: string | undefined, unit = 'g') => {
    if (!value) return 'N/A'
    const num = parseFloat(value)
    return isNaN(num) ? 'N/A' : `${num}${unit}`
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="h-5 w-5" />
          Nutrition Search
        </CardTitle>
        <CardDescription>
          Search for foods and view detailed nutrition information from FatSecret's database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Form */}
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

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedFood && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Search Results:</h4>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((food) => (
                <div
                  key={food.food_id}
                  className="p-2 border rounded cursor-pointer hover:bg-[#faf8f5] transition-colors"
                  onClick={() => getFoodDetails(food.food_id)}
                >
                  <div className="font-medium text-sm">{food.food_name}</div>
                  {food.brand_name && (
                    <div className="text-xs text-[#8e99a8]">{food.brand_name}</div>
                  )}
                  <div className="text-xs text-[#8e99a8] mt-1">
                    {food.food_description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading Details */}
        {isLoadingDetails && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm">Loading nutrition details...</span>
          </div>
        )}

        {/* Food Details */}
        {selectedFood && !isLoadingDetails && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{selectedFood.food.food_name}</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFood(null)}
              >
                Back to Search
              </Button>
            </div>

            {selectedFood.food.servings?.serving?.length > 0 && (
              <div className="space-y-3">
                {selectedFood.food.servings.serving.slice(0, 3).map((serving, index) => (
                  <div key={serving.serving_id || index} className="border rounded p-3">
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
                      {serving.fiber && (
                        <div className="flex justify-between">
                          <span>Fiber:</span>
                          <span className="font-medium">{formatNutrientValue(serving.fiber)}</span>
                        </div>
                      )}
                      {serving.sugar && (
                        <div className="flex justify-between">
                          <span>Sugar:</span>
                          <span className="font-medium">{formatNutrientValue(serving.sugar)}</span>
                        </div>
                      )}
                      {serving.sodium && (
                        <div className="flex justify-between">
                          <span>Sodium:</span>
                          <span className="font-medium">{formatNutrientValue(serving.sodium, 'mg')}</span>
                        </div>
                      )}
                      {serving.saturated_fat && (
                        <div className="flex justify-between">
                          <span>Sat. Fat:</span>
                          <span className="font-medium">{formatNutrientValue(serving.saturated_fat)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {selectedFood.food.servings.serving.length > 3 && (
                  <div className="text-center text-sm text-[#8e99a8]">
                    + {selectedFood.food.servings.serving.length - 3} more serving sizes available
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {searchResults.length === 0 && !selectedFood && !isSearching && searchQuery && (
          <div className="text-center py-8 text-[#8e99a8]">
            <Apple className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No foods found for "{searchQuery}"</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        )}

        {/* Initial State */}
        {!searchQuery && searchResults.length === 0 && !selectedFood && (
          <div className="text-center py-8 text-[#8e99a8]">
            <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Search for any food to see nutrition facts</p>
            <p className="text-sm">Try searching for "apple", "chicken breast", or "oatmeal"</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
