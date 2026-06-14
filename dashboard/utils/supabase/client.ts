'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * createSupabaseBrowserClient
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns a Supabase client that is safe to use in Client Components.
 *
 * Uses the @supabase/ssr browser variant which correctly handles cookie-based
 * auth in the browser context.
 *
 * Usage:
 *   const supabase = createSupabaseBrowserClient()
 *   const { data } = await supabase.from('reels').select('*')
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
