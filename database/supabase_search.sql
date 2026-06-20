-- =============================================================================
-- Reels Second Brain — Semantic Search RPC Function
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- This creates the `match_reels` PostgreSQL function that powers the
-- semantic vector search feature on the dashboard. It uses pgvector's
-- cosine distance operator (<=>) to find reels whose AI summary embeddings
-- are closest to a given query embedding.
--
-- Prerequisites:
--   • The `vector` extension must be enabled (see schema.sql Step 1).
--   • The `reels` table must have an `embedding vector(768)` column.
--   • The IVFFlat index on `embedding` should be built after ingesting
--     data (see schema.sql Step 3).
-- =============================================================================

CREATE OR REPLACE FUNCTION match_reels(
  -- The 768-dimensional query embedding produced by nomic-embed-text
  -- (matches the same model used by the worker's Ollama embed step).
  query_embedding  vector(768),

  -- Minimum cosine similarity score (0.0–1.0) for a row to be returned.
  -- 0.0 = any direction, 1.0 = identical vectors.
  -- A threshold of 0.40–0.50 gives good results for semantic search.
  match_threshold  float,

  -- Maximum number of rows to return.
  match_count      int
)
RETURNS TABLE (
  id                uuid,
  original_url      text,
  transcript        text,
  ai_summary        text,
  entities          jsonb,
  created_at        timestamptz,
  -- Cosine similarity: 1 − cosine_distance. Ranges from 0.0 to 1.0.
  -- Higher = more semantically similar to the query.
  similarity        float
)
LANGUAGE plpgsql
STABLE           -- results are consistent within a single transaction
SECURITY DEFINER -- runs with the definer's privileges (bypasses RLS safely)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.original_url,
    r.transcript,
    r.ai_summary,
    r.entities,
    r.created_at,
    -- Convert cosine *distance* (0 = identical, 2 = opposite) to
    -- cosine *similarity* (1 = identical, -1 = opposite) and range-clip to [0, 1].
    (1 - (r.embedding <=> query_embedding))::float AS similarity
  FROM   public.reels r
  WHERE
    -- Only consider rows that have been processed (embedding IS NOT NULL).
    r.embedding IS NOT NULL
    -- Filter out any rows where the AI summary indicates a failed processing.
    AND (r.ai_summary IS NULL OR r.ai_summary NOT LIKE '%[FAILED]%')
    -- Apply the similarity threshold filter.
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    -- Order by ascending cosine distance = descending similarity.
    r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- Grant execute permission to the anonymous (public) and authenticated roles
-- so the Supabase JS client can call this function from the dashboard.
-- The SECURITY DEFINER clause above ensures it still runs with correct
-- privileges despite being called by the anon role.
-- =============================================================================
GRANT EXECUTE ON FUNCTION match_reels(vector(768), float, int)
  TO anon, authenticated, service_role;

-- Quick smoke-test — should return 0 rows but must not error.
-- Uncomment and run manually after deploying to verify the function exists.
-- SELECT * FROM match_reels(array_fill(0.0, ARRAY[768])::vector, 0.5, 5);
