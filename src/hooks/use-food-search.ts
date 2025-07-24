'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDataCache } from '@/hooks/use-data-cache'
import { FatSecretFood, FatSecretSearchResponse, FatSecretFoodDetail } from '@/lib/fatsecret/client'

interface FatSecretServing {
  calories: string
  protein: string
  carbohydrate: string
  fat: string
  serving_description: string
  serving_id: string
  [key: string]: any
}

export function useFoodSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFood, setSelectedFood] = useState<FatSecretFoodDetail | null>(null)
  const [selectedServing, setSelectedServing] = useState<FatSecretServing | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search with cache
  const searchCache = useDataCache<FatSecretFood[]>(
    `food-search-${searchQuery}`,
    async () => {
      if (!searchQuery.trim() || searchQuery.length < 3) return []
      
      const response = await fetch(`/api/fatsecret/search?q=${encodeURIComponent(searchQuery)}&max_results=15`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to search foods')
      }
      
      const data: FatSecretSearchResponse = await response.json()
      return data.foods?.food || []
    },
    { 
      ttl: 10 * 60 * 1000, // 10 minutes cache
      prefetch: false
    }
  )

  const searchResults = searchCache.data || []
  const searchLoading = searchCache.loading

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timeoutId = setTimeout(() => {
        searchCache.refetch() // Trigger refetch
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, searchCache])

  const getFoodDetails = useCallback(async (foodId: string) => {
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
  }, [])

  const resetSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedFood(null)
    setSelectedServing(null)
    setError(null)
    searchCache.invalidate()
  }, [searchCache])

  const clearError = useCallback(() => setError(null), [])

  // Enhanced search suggestions
  const getSearchSuggestions = useCallback((query: string) => {
    const suggestions = [
      'chicken breast',
      'brown rice',
      'broccoli',
      'salmon',
      'greek yogurt',
      'banana',
      'oatmeal',
      'eggs',
      'spinach',
      'sweet potato'
    ]
    
    return suggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5)
  }, [])

  return {
    // Search state
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    
    // Selected food state
    selectedFood,
    setSelectedFood,
    selectedServing,
    setSelectedServing,
    isLoadingDetails,
    
    // Error state
    error,
    clearError,
    
    // Actions
    getFoodDetails,
    resetSearch,
    getSearchSuggestions
  }
}
