import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/utils/supabase/server'

// =============================================================================
// GET /api/latest
// =============================================================================
// Fetches the latest 100 reel URLs from the database.
// Used by the Chrome Extension to implement 'Delta Syncing' so it knows
// when to stop scrolling.
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders })
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()

    // Query the reels table for the most recent 100 entries
    const { data, error } = await supabase
      .from('reels')
      .select('original_url')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[latest] Database error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    // Map array of objects to a simple string array of URLs
    const urls = data.map((row) => row.original_url)

    return NextResponse.json(
      { urls },
      { status: 200, headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown configuration error'
    console.error('[latest] Server error:', message)
    return NextResponse.json(
      { error: `Server configuration error: ${message}` },
      { status: 500, headers: corsHeaders }
    )
  }
}
