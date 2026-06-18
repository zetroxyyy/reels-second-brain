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
        onConflict: 'original_url',
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

// =============================================================================
// searchReels
// =============================================================================
/**
 * Semantic vector search across all processed reels.
 *
 * Pipeline:
 *   1. Lazy-load the @huggingface/transformers embedding pipeline (cached in module
 *      scope so subsequent calls in the same Vercel function instance are fast).
 *   2. Embed the user's query string into a 768-dim float array using the
 *      Xenova/nomic-embed-text-v1.5 ONNX model — the exact same model that
 *      the VPS worker uses via Ollama, so vectors are in the same space.
 *   3. Call the `match_reels` Supabase RPC (see supabase_search.sql) with the
 *      vector, which performs approximate nearest-neighbour search via pgvector.
 *   4. Return the ranked array of matching reel rows.
 *
 * Cold-start note:
 *   The first call on a fresh Vercel function instance will download the
 *   quantized ONNX model (~133 MB) to /tmp and may take 30–60 seconds.
 *   Subsequent calls in the same instance reuse the cached pipeline and
 *   typically complete in under 2 seconds.
 *
 * @param query — Plain-text search query from the user.
 * @returns     — Array of matching reel rows ordered by cosine similarity.
 */

// Module-level lazy loaded extractor cache (singleton)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorCache: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function searchReels(query: string): Promise<any[]> {
  try {
    const trimmed = query?.trim()
    if (!trimmed || trimmed.length < 2) return []

    // ── 1. Embed the query ──────────────────────────────────────────────────────
    let embedding: number[]
    try {
      if (!extractorCache) {
        // Dynamic import guarantees ONNX/transformers.js is not loaded during build/initial SSR
        const { pipeline, env } = await import('@huggingface/transformers') as any
        env.allowLocalModels = false
        env.useBrowserCache = false

        extractorCache = await pipeline(
          'feature-extraction',
          'Xenova/nomic-embed-text-v1.5',
          { quantized: true }
        )
      }

      // Generate query embedding with search_query: prefix for nomic-embed-text compatibility
      const prefixedQuery = `search_query: ${trimmed}`
      const output = await extractorCache(prefixedQuery, { pooling: 'mean', normalize: true })
      embedding = Array.from(output.data as Float32Array)
    } catch (err) {
      console.error('[searchReels] Embedding error:', err)
      return [] // Return an empty array gracefully on embedding failure
    }

    if (embedding.length !== 768) {
      console.error(`[searchReels] Unexpected embedding dimension: ${embedding.length} (expected 768).`)
      return []
    }

    // ── 2. Call Supabase match_reels RPC ────────────────────────────────────────
    let supabase: ReturnType<typeof createSupabaseServiceClient>
    try {
      supabase = createSupabaseServiceClient()
    } catch (err) {
      console.error('[searchReels] Supabase client configuration error:', err)
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('match_reels', {
      query_embedding: embedding,
      match_threshold: 0.40,   // 40 % cosine similarity minimum
      match_count: 30,     // max 30 results
    })

    if (error) {
      console.error('[searchReels] RPC error:', error)
      return []
    }

    return (data as any[]) ?? []
  } catch (globalErr) {
    console.error('[searchReels] Unhandled exception in searchReels:', globalErr)
    return []
  }
}

// =============================================================================
// retryFailedReels
// =============================================================================
/**
 * Resets the processing status of any failed reels by setting their ai_summary to NULL.
 * This prompts the background Python worker to re-attempt downloading and processing.
 */
export async function retryFailedReels(): Promise<{ success: boolean; error?: string }> {
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
    .update({ ai_summary: null })
    .like('ai_summary', '[FAILED]%')

  if (error) {
    console.error('[retryFailedReels] Supabase error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}
