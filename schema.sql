-- =============================================================================
-- Reels Second Brain — Supabase SQL Schema
-- Run these commands in order in the Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Enable the pgvector extension
-- This is required for the vector embedding column.
-- Must be run before creating any table that uses the vector type.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Step 2: Create the `reels` table
-- Central store for every ingested Instagram Reel.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reels (
  -- Primary identifier — auto-generated UUID
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The canonical Instagram Reel URL (e.g. https://www.instagram.com/reel/ABC123/)
  -- UNIQUE ensures the upsert endpoint is idempotent: re-ingesting the same
  -- export file will never create duplicate rows.
  original_url      TEXT          NOT NULL UNIQUE,

  -- Populated by the future VPS downloader/processor.
  -- Stores the object-storage path (e.g. "reels/ABC123/video.mp4")
  video_path        TEXT,

  -- Full speech-to-text transcript of the reel's audio track.
  transcript        TEXT,

  -- AI-generated description of the visual content (frames, scene, etc.)
  visual_description TEXT,

  -- Concise AI-generated summary combining audio + visual context.
  ai_summary        TEXT,

  -- Structured extracted metadata: tags, topics, ingredients, people, etc.
  -- Stored as JSONB for flexible querying (e.g. entities->>'cuisine' = 'Italian').
  -- Example shape: { "tags": ["recipe", "pasta"], "ingredients": ["flour"] }
  entities          JSONB,

  -- 768-dimensional semantic embedding vector.
  -- Sized for local Ollama models (e.g. nomic-embed-text, mxbai-embed-large).
  -- Used for similarity search via pgvector.
  embedding         vector(768),

  -- Row creation timestamp — set automatically on INSERT.
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Step 3: Indexes for common query patterns
-- -----------------------------------------------------------------------------

-- Index on original_url for fast duplicate checks (the UNIQUE constraint
-- already creates a btree index, but we document it explicitly for clarity).
-- No need to create a separate one.

-- Index on created_at for time-ordered listing queries.
CREATE INDEX IF NOT EXISTS idx_reels_created_at
  ON public.reels (created_at DESC);

-- Index on entities JSONB for tag filtering queries.
CREATE INDEX IF NOT EXISTS idx_reels_entities
  ON public.reels USING gin (entities);

-- IVFFlat vector index for approximate nearest-neighbour (ANN) similarity search.
-- lists=100 is a good default for tables up to ~1M rows.
-- Build this AFTER you have loaded at least some embeddings, otherwise it
-- won't help the query planner.
CREATE INDEX IF NOT EXISTS idx_reels_embedding
  ON public.reels USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- -----------------------------------------------------------------------------
-- Step 4: Row Level Security (RLS)
-- Enable RLS and add a policy so only authenticated users can read/write.
-- Adjust the policy to match your auth strategy (service-role bypass is fine
-- for the ingestion API route which uses the service-role key).
-- -----------------------------------------------------------------------------
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (logged in via Supabase Auth) full access.
CREATE POLICY "Authenticated users have full access to reels"
  ON public.reels
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Service-role key bypasses RLS by design — the ingestion route can therefore
-- upsert freely without needing an additional policy.

-- -----------------------------------------------------------------------------
-- Step 5: Helpful comments for the schema
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.reels IS
  'Central store for every Instagram Reel ingested by Reels Second Brain.';
COMMENT ON COLUMN public.reels.original_url IS
  'Canonical Instagram Reel URL — the primary identifier from Phase 1 extraction.';
COMMENT ON COLUMN public.reels.embedding IS
  'pgvector 768-dim semantic embedding for similarity search (Ollama models).';
COMMENT ON COLUMN public.reels.entities IS
  'JSONB bag of extracted structured metadata: tags, ingredients, people, topics.';
