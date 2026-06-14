import { z } from 'zod'

// =============================================================================
// Reels Second Brain — Database Types (types/database.ts)
// =============================================================================
// Architecture:
//  1. Explicit TypeScript interfaces for the Supabase `Database` generic
//     (these must be plain TS types — no complex Zod inference).
//  2. Zod schemas for *runtime* validation of inbound data (API routes, etc.).
//     The Zod types are kept in sync with the interfaces manually.
//
// Import guide:
//   - `Database`         — generic type param for the Supabase client
//   - `ReelRow`          — type of a full row returned by SELECT
//   - `ReelInsert`       — type for INSERT / UPSERT operations
//   - `ReelUpdate`       — type for PATCH / UPDATE operations
//   - `Entities`         — shape of the JSONB entities column
//   - `ExtensionExport`  — validated type of the Chrome Extension JSON export
// =============================================================================

// =============================================================================
// SECTION 1: Plain TypeScript interfaces
// (Used as the Supabase Database generic — must be simple, explicit types)
// =============================================================================

/** Shape of the JSONB `entities` column */
export interface Entities {
  /** Free-form topic / concept tags */
  tags?:        string[]
  /** Ingredients (for food reels) */
  ingredients?: string[]
  /** Named people mentioned or appearing */
  people?:      string[]
  /** Primary topic category */
  topic?:       string
  /** Detected language of the audio/text */
  language?:    string
  /** Catch-all for future keys */
  [key: string]: unknown
}

/** Full row — matches a `SELECT *` result from the `reels` table */
export interface ReelRow {
  id:                 string          // UUID
  original_url:       string
  video_path:         string | null
  transcript:         string | null
  visual_description: string | null
  ai_summary:         string | null
  entities:           Entities | null
  embedding:          number[] | null  // vector(768)
  created_at:         string          // ISO-8601 timestamptz
}

/**
 * Insert / Upsert type.
 * `original_url` is the only required field; everything else is filled in later
 * by the VPS processing pipeline.
 */
export interface ReelInsert {
  original_url:        string
  video_path?:         string | null
  transcript?:         string | null
  visual_description?: string | null
  ai_summary?:         string | null
  entities?:           Entities | null
  embedding?:          number[] | null
}

/** Update / PATCH type — all fields optional */
export interface ReelUpdate {
  original_url?:       string
  video_path?:         string | null
  transcript?:         string | null
  visual_description?: string | null
  ai_summary?:         string | null
  entities?:           Entities | null
  embedding?:          number[] | null
}

// =============================================================================
// SECTION 2: Supabase Database type definition
// This is the generic type parameter for createClient<Database>() and
// createServerClient<Database>(). Extend this object as you add more tables.
// =============================================================================

export type Database = {
  public: {
    Tables: {
      reels: {
        Row:    ReelRow
        Insert: ReelInsert
        Update: ReelUpdate
      }
    }
    Views:     Record<string, never>
    Functions: Record<string, never>
    Enums:     Record<string, never>
  }
}

// =============================================================================
// SECTION 3: Zod schemas for runtime validation
// These validate *incoming data at the boundary* (API request bodies, etc.).
// They are intentionally separate from the TS interfaces above.
// =============================================================================

/** Runtime validator for the JSONB entities shape */
export const EntitiesSchema = z
  .object({
    tags:        z.array(z.string()).optional(),
    ingredients: z.array(z.string()).optional(),
    people:      z.array(z.string()).optional(),
    topic:       z.string().optional(),
    language:    z.string().optional(),
  })
  .catchall(z.unknown())

/**
 * Runtime validator for a full reel row (e.g. for API response validation).
 * Mirrors the `ReelRow` interface above.
 */
export const ReelRowSchema = z.object({
  id:                 z.string().uuid(),
  original_url:       z.string().url(),
  video_path:         z.string().nullable(),
  transcript:         z.string().nullable(),
  visual_description: z.string().nullable(),
  ai_summary:         z.string().nullable(),
  entities:           EntitiesSchema.nullable(),
  embedding:          z.array(z.number()).nullable().optional(),
  created_at:         z.string().datetime({ offset: true }),
})

/**
 * Runtime validator for an insert payload.
 * Only `original_url` is required.
 */
export const ReelInsertSchema = z.object({
  original_url:        z.string().url(),
  video_path:          z.string().nullish(),
  transcript:          z.string().nullish(),
  visual_description:  z.string().nullish(),
  ai_summary:          z.string().nullish(),
  entities:            EntitiesSchema.nullish(),
  embedding:           z.array(z.number()).nullish(),
})

// =============================================================================
// SECTION 4: Phase 1 Chrome Extension export payload schema
// Matches the exact JSON structure produced by content.js → downloadJSON()
// =============================================================================

const ExtensionReelItemSchema = z.object({
  id:  z.number().int().positive(),
  url: z.string().url(),
})

export const ExtensionExportSchema = z.object({
  exportedAt:  z.string().datetime({ offset: true }),
  source:      z.string().url(),
  totalReels:  z.number().int().nonnegative(),
  reels:       z.array(ExtensionReelItemSchema),
})

export type ExtensionExport   = z.infer<typeof ExtensionExportSchema>
export type ExtensionReelItem = z.infer<typeof ExtensionReelItemSchema>
