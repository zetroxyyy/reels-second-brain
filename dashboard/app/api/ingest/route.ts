import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ExtensionExportSchema } from '@/types/database'
import { createSupabaseServiceClient } from '@/utils/supabase/server'

// =============================================================================
// POST /api/ingest
// =============================================================================
// Accepts the JSON payload produced by the Phase 1 Chrome Extension and
// upserts each reel URL into the Supabase `reels` table.
//
// Request body shape (from content.js downloadJSON()):
// {
//   "exportedAt":  "2025-06-14T10:30:00.000Z",
//   "source":      "https://www.instagram.com/username/saved/all-posts/",
//   "totalReels":  247,
//   "reels": [
//     { "id": 1, "url": "https://www.instagram.com/reel/ABC123/" },
//     ...
//   ]
// }
//
// Response shape (success):
// {
//   "success":   true,
//   "inserted":  230,   // newly-added rows
//   "skipped":   17,    // already existed (upsert no-op)
//   "total":     247,
//   "errors":    []     // per-URL errors if any
// }
// =============================================================================

/** Maximum reels we'll process in a single request (safety cap) */
const MAX_REELS_PER_REQUEST = 5_000

/** How many rows to upsert in a single Supabase call */
const UPSERT_BATCH_SIZE = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  // ── 1. Parse & validate request body ──────────────────────────────────────
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:   'Invalid JSON body. Make sure Content-Type is application/json.',
      },
      { status: 400 }
    )
  }

  // Validate against the Zod schema that mirrors the extension's output format.
  let parsedPayload: ReturnType<typeof ExtensionExportSchema.parse>

  try {
    parsedPayload = ExtensionExportSchema.parse(rawBody)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error:   'Payload validation failed.',
          details: err.flatten(),        // structured field-level errors
        },
        { status: 422 }
      )
    }
    throw err // unexpected — let the global handler surface it
  }

  const { reels, exportedAt, source } = parsedPayload

  // ── 2. Guard: empty or oversized payloads ─────────────────────────────────
  if (reels.length === 0) {
    return NextResponse.json(
      { success: true, inserted: 0, skipped: 0, total: 0, errors: [] },
      { status: 200 }
    )
  }

  if (reels.length > MAX_REELS_PER_REQUEST) {
    return NextResponse.json(
      {
        success: false,
        error: `Payload contains ${reels.length} reels which exceeds the limit of ${MAX_REELS_PER_REQUEST} per request. Split the export file and try again.`,
      },
      { status: 413 }
    )
  }

  // ── 3. Build Supabase service client (bypasses RLS) ───────────────────────
  let supabase: ReturnType<typeof createSupabaseServiceClient>

  try {
    supabase = createSupabaseServiceClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown configuration error'
    return NextResponse.json(
      { success: false, error: `Server configuration error: ${message}` },
      { status: 500 }
    )
  }

  // ── 4. Canonicalize URLs ───────────────────────────────────────────────────
  // Strip query params and trailing slashes — same logic as the extension's
  // harvestReels() function — to ensure perfect deduplication.
  const canonicalize = (url: string): string =>
    url.split('?')[0].replace(/\/$/, '')

  // Deduplicate within this payload (the extension already uses a Set, but
  // an extra guard here is cheap).
  const uniqueUrls = [...new Set(reels.map(r => canonicalize(r.url)))]

  // ── 5. Batch-upsert into Supabase ─────────────────────────────────────────
  // We use upsert with ignoreDuplicates so re-running the same export is safe.
  // The ON CONFLICT target is `original_url` (defined UNIQUE in the schema).
  //
  // Note: The Supabase TypeScript generic can over-narrow the `upsert()` call
  // when the Database Insert type has optional/nullable complex fields (Entities
  // with index signatures, etc.). To avoid that, we use `from()` without the
  // generic type parameter here and let TypeScript infer from runtime values.
  // The Zod validation above already guarantees the shape is correct.
  let totalInserted = 0
  const perUrlErrors: Array<{ url: string; error: string }> = []

  for (let i = 0; i < uniqueUrls.length; i += UPSERT_BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + UPSERT_BATCH_SIZE)

    // Build the minimal insert row — only `original_url` is needed.
    // The rest of the columns will be populated by the Phase 3 VPS pipeline.
    const rows = batch.map(url => ({ original_url: url }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from('reels')
      .upsert(rows, {
        onConflict:       'original_url', // match the UNIQUE constraint
        ignoreDuplicates: true,           // silently skip existing rows
        count:            'exact',        // ask Supabase to return the affected row count
      })

    if (error) {
      // Batch-level error — record individual errors for every URL in the batch
      // (we can't tell which one failed) and continue with remaining batches.
      console.error(`[ingest] Batch ${i}–${i + batch.length - 1} error:`, error)
      batch.forEach(url => perUrlErrors.push({ url, error: error.message }))
    } else {
      // `count` is the number of rows actually inserted (skips are not counted).
      totalInserted += count ?? 0
    }
  }

  const totalSkipped = uniqueUrls.length - totalInserted - perUrlErrors.length

  // ── 6. Log summary ────────────────────────────────────────────────────────
  console.info(
    `[ingest] exportedAt=${exportedAt} source=${source} ` +
      `total=${uniqueUrls.length} inserted=${totalInserted} ` +
      `skipped=${totalSkipped} errors=${perUrlErrors.length}`
  )

  // ── 7. Return response ────────────────────────────────────────────────────
  const hasErrors = perUrlErrors.length > 0

  return NextResponse.json(
    {
      success:  !hasErrors,
      inserted: totalInserted,
      skipped:  totalSkipped,
      total:    uniqueUrls.length,
      errors:   perUrlErrors,
      ...(hasErrors && {
        warning: `${perUrlErrors.length} URLs failed to ingest. See the 'errors' array for details.`,
      }),
    },
    { 
      status: hasErrors ? 207 : 200, // 207 Multi-Status when partial failures
      headers: corsHeaders
    }
  )
}

// ── Method guard ─────────────────────────────────────────────────────────────
// Explicitly reject non-POST methods with a clear error message.
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST to ingest reels.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
