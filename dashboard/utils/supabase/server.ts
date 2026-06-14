import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * createSupabaseServerClient
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns a Supabase client that is safe to use in:
 *   - Server Components
 *   - Route Handlers (API routes)
 *   - Server Actions
 *
 * Uses the @supabase/ssr package which correctly handles cookie-based auth
 * on the server without leaking session data between requests.
 *
 * The client is typed against our generated `Database` interface so every
 * query is fully type-safe and autocompleted.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be safely ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * createSupabaseServiceClient
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns a Supabase client authenticated with the SERVICE ROLE key.
 *
 * ⚠️  IMPORTANT: This client bypasses Row Level Security (RLS).
 *     ONLY use it in trusted server-side code (API Route Handlers, cron jobs).
 *     NEVER expose it to the browser or import it in Client Components.
 *
 * Used by the /api/ingest endpoint to upsert reels without requiring the
 * caller to be authenticated.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createSupabaseServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Add it to your .env.local file. ' +
        'Find it in: Supabase Dashboard → Project Settings → API → service_role.'
    )
  }

  // We use the base supabase-js client (not the SSR wrapper) because
  // service-role operations are stateless — they do not need cookie handling.
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // Disable auto-refreshing tokens — the service client is stateless.
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  )
}
