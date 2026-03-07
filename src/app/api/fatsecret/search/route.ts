import { NextRequest, NextResponse } from 'next/server'
import { getFatSecretAccessToken, searchFoods } from '@/lib/fatsecret/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const pageNumber = parseInt(searchParams.get('page') || '0')
  const maxResults = parseInt(searchParams.get('max_results') || '20')

  if (!query) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
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
    
    // Search for foods
    const searchResults = await searchFoods(tokenResponse.access_token, query, pageNumber, maxResults)

    const res = NextResponse.json(searchResults)
    res.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200')
    return res

  } catch (error) {
    console.error('FatSecret search error:', error)
    
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
      { error: 'Failed to search foods' },
      { status: 500 }
    )
  }
}
