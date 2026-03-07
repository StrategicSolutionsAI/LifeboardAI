import { NextRequest, NextResponse } from 'next/server'
import { getFatSecretAccessToken, getFoodDetails } from '@/lib/fatsecret/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const foodId = searchParams.get('food_id')

  if (!foodId) {
    return NextResponse.json({ error: 'Food ID is required' }, { status: 400 })
  }

  // Check if FatSecret credentials are configured
  if (!process.env.FATSECRET_CLIENT_ID || !process.env.FATSECRET_CLIENT_SECRET) {
    return NextResponse.json({ 
      error: 'FatSecret API credentials not configured. Please add FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET to your environment variables.' 
    }, { status: 500 })
  }

  try {
    // Get access token using app credentials
    const tokenResponse = await getFatSecretAccessToken()
    
    // Get food details
    const foodDetails = await getFoodDetails(tokenResponse.access_token, foodId)

    const res = NextResponse.json(foodDetails)
    res.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200')
    return res

  } catch (error) {
    console.error('FatSecret food details error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('client credentials')) {
        return NextResponse.json(
          { error: 'Invalid FatSecret API credentials. Please check your FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch food details' },
      { status: 500 }
    )
  }
}
