import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Supabase Auth Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Refreshes the user's Supabase session on every request so Server Components
 * always have an up-to-date session token.
 *
 * Place this file at: dashboard/middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — this is required to keep the user logged in.
  // Do not add any logic between createServerClient and supabase.auth.getUser().
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico   (favicon)
     *  - Public API routes that don't need auth (e.g. /api/ingest handles its own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/ingest).*)',
  ],
}
