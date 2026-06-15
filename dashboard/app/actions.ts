'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServiceClient } from '@/utils/supabase/server'

// =============================================================================
// Server Actions — app/actions.ts
// =============================================================================
// Two secure, server-side mutations that run via Next.js Server Actions.
// Both use the service-role Supabase client (bypasses RLS) and are safe
// to call from Client Components via <form action={...}> or useTransition.
// =============================================================================

/**
 * canonicalizeUrl
 * ─────────────────────────────────────────────────────────────────────────────
 * Strips query-string parameters and trailing slashes so the URL stored in
 * Supabase always matches what the Chrome Extension and /api/ingest produce.
 *   e.g. "https://www.instagram.com/reel/ABC123/?igsh=xyz" → "https://www.instagram.com/reel/ABC123"
 */
function canonicalizeUrl(rawUrl: string): string {
  return rawUrl.split('?')[0].replace(/\/$/, '')
}

// =============================================================================
// deleteReel
// =============================================================================
/**
 * Permanently deletes a single reel row by its UUID primary key.
 * Revalidates the dashboard root so the grid refreshes immediately.
 *
 * @param id — UUID of the reel row to delete
 */
export async function deleteReel(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id || typeof id !== 'string') {
    return { success: false, error: 'Invalid reel ID.' }
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>
  try {
    supabase = createSupabaseServiceClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error'
    return { success: false, error: message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('reels')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteReel] Supabase error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

// =============================================================================
// manualIngest
// =============================================================================
/**
 * Inserts a single Instagram Reel URL into the database from the dashboard UI.
 * Canonicalizes the URL before upserting so duplicates are always detected.
 * Revalidates the dashboard root so the new card appears immediately.
 *
 * @param url — Raw Instagram Reel URL pasted by the user
 */
export async function manualIngest(url: string): Promise<{ success: boolean; error?: string }> {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'URL is required.' }
  }

  const cleanUrl = canonicalizeUrl(url.trim())

  // Basic validation — must look like a URL
  try {
    new URL(cleanUrl)
  } catch {
    return { success: false, error: 'Please enter a valid URL.' }
  }

  if (!cleanUrl.includes('instagram.com')) {
    return { success: false, error: 'Only Instagram URLs are supported.' }
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>
  try {
    supabase = createSupabaseServiceClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error'
    return { success: false, error: message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('reels')
    .upsert(
      [{ original_url: cleanUrl }],
      {
        onConflict:       'original_url',
        ignoreDuplicates: true,
      }
    )

  if (error) {
    console.error('[manualIngest] Supabase error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}
