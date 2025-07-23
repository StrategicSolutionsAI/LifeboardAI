const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const FATSECRET_API_BASE = 'https://platform.fatsecret.com/rest/server.api'

// FatSecret scopes - basic is required for food search and nutrition data
export const FATSECRET_SCOPES = ['basic']

export interface FatSecretTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface FatSecretFood {
  food_id: string
  food_name: string
  food_type: string
  food_url: string
  brand_name?: string
  food_description: string
}

export interface FatSecretSearchResponse {
  foods: {
    food: FatSecretFood[]
    max_results: string
    page_number: string
    total_results: string
  }
}

export interface FatSecretNutrition {
  calories: string
  carbohydrate: string
  fat: string
  fiber?: string
  protein: string
  saturated_fat?: string
  sodium?: string
  sugar?: string
}

export interface FatSecretFoodDetail {
  food: {
    food_id: string
    food_name: string
    food_type: string
    food_url: string
    servings: {
      serving: Array<{
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
      }>
    }
  }
}

/**
 * Get access token using client credentials flow
 * FatSecret uses OAuth 2.0 client credentials for server-to-server authentication
 */
export async function getFatSecretAccessToken(): Promise<FatSecretTokenResponse> {
  const clientId = process.env.FATSECRET_CLIENT_ID
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret client credentials not configured')
  }

  // Create basic auth header
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(FATSECRET_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: FATSECRET_SCOPES.join(' ')
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FatSecret token request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data as FatSecretTokenResponse
}

/**
 * Search for foods in the FatSecret database
 */
export async function searchFoods(
  accessToken: string, 
  searchExpression: string, 
  pageNumber = 0, 
  maxResults = 20
): Promise<FatSecretSearchResponse> {
  const params = new URLSearchParams({
    method: 'foods.search',
    search_expression: searchExpression,
    page_number: pageNumber.toString(),
    max_results: maxResults.toString(),
    format: 'json'
  })

  const response = await fetch(FATSECRET_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FatSecret foods search failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data as FatSecretSearchResponse
}

/**
 * Get detailed nutrition information for a specific food
 */
export async function getFoodDetails(
  accessToken: string, 
  foodId: string
): Promise<FatSecretFoodDetail> {
  const params = new URLSearchParams({
    method: 'food.get.v4',
    food_id: foodId,
    format: 'json'
  })

  const response = await fetch(FATSECRET_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FatSecret food details failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data as FatSecretFoodDetail
}

/**
 * Get nutrition summary for a food item (first serving)
 */
export async function getFoodNutrition(
  accessToken: string, 
  foodId: string
): Promise<FatSecretNutrition | null> {
  try {
    const foodDetail = await getFoodDetails(accessToken, foodId)
    const firstServing = foodDetail.food.servings.serving[0]
    
    if (!firstServing) {
      return null
    }

    return {
      calories: firstServing.calories,
      carbohydrate: firstServing.carbohydrate,
      fat: firstServing.fat,
      fiber: firstServing.fiber,
      protein: firstServing.protein,
      saturated_fat: firstServing.saturated_fat,
      sodium: firstServing.sodium,
      sugar: firstServing.sugar
    }
  } catch (error) {
    console.error('Error fetching food nutrition:', error)
    return null
  }
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(tokenData: any, updatedAt: string): boolean {
  if (!tokenData.expires_in || !updatedAt) {
    return true
  }

  const updated = new Date(updatedAt).getTime()
  const expiresAt = updated + tokenData.expires_in * 1000
  return Date.now() > expiresAt - 60 * 1000 // 1 minute buffer
}
