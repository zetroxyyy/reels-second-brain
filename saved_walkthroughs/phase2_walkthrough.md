# Reels Second Brain — Phase 2 Walkthrough

## What Was Built

Phase 2 establishes the Next.js + Supabase foundation: the database schema, TypeScript types, Supabase client utilities, and the ingestion API route that bridges the Phase 1 Chrome Extension to the database.

---

## Full Project Structure

```
reels-second-brain/
├── schema.sql                          ← Task 1: Run in Supabase SQL Editor
├── audit_phase2.ps1                    ← Requirements verification script
│
└── dashboard/                          ← Next.js 16 App (Task 2 & 3)
    ├── types/
    │   └── database.ts                 ← Task 2: TypeScript interfaces + Zod schemas
    ├── utils/
    │   └── supabase/
    │       ├── server.ts               ← Task 2: Server + service-role client
    │       └── client.ts              ← Bonus: Browser client for Client Components
    ├── app/
    │   ├── api/
    │   │   └── ingest/
    │   │       └── route.ts            ← Task 3: POST /api/ingest
    │   ├── layout.tsx
    │   └── page.tsx
    ├── middleware.ts                   ← Supabase auth session refresh
    ├── .env.local.example              ← Environment variable template
    ├── package.json                    ← next, @supabase/ssr, @supabase/supabase-js, zod
    └── tsconfig.json                   ← @/* path alias configured
```

---

## Task 1: SQL Schema (`schema.sql`)

Run in the Supabase SQL Editor in this order:

| Step | What It Does |
|---|---|
| `CREATE EXTENSION vector` | Enables pgvector for 768-dim embeddings |
| `CREATE TABLE reels` | All 9 required columns with correct types |
| `CREATE INDEX idx_reels_created_at` | Time-ordered listing queries |
| `CREATE INDEX idx_reels_entities (GIN)` | JSONB tag/ingredient filtering |
| `CREATE INDEX idx_reels_embedding (IVFFlat)` | ANN similarity search |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | RLS on by default |
| `CREATE POLICY` | Authenticated users have full access |

### Column Map

| Column | SQL Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Auto-generated |
| `original_url` | `TEXT NOT NULL UNIQUE` | The conflict key for upserts |
| `video_path` | `TEXT` (nullable) | Set by Phase 3 VPS |
| `transcript` | `TEXT` (nullable) | Set by Phase 3 VPS |
| `visual_description` | `TEXT` (nullable) | Set by Phase 3 AI pipeline |
| `ai_summary` | `TEXT` (nullable) | Set by Phase 3 AI pipeline |
| `entities` | `JSONB` (nullable) | Tags, ingredients, people |
| `embedding` | `vector(768)` | Ollama embedding size |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Auto-generated |

---

## Task 2: TypeScript + Supabase Client

### `types/database.ts` Architecture

Two-layer design:
1. **Plain TypeScript interfaces** (`ReelRow`, `ReelInsert`, `ReelUpdate`, `Entities`, `Database`) — used as Supabase generic type parameters
2. **Zod schemas** (`ReelRowSchema`, `ReelInsertSchema`, `ExtensionExportSchema`) — used for runtime validation at the API boundary

This separation is intentional: Supabase's `RejectExcessProperties<>` generic requires simple structural types; Zod inference with optional/nullable complex fields causes TypeScript to over-narrow to `never`.

### `utils/supabase/server.ts`

| Export | Purpose |
|---|---|
| `createSupabaseServerClient()` | Cookie-aware client for Server Components & Route Handlers |
| `createSupabaseServiceClient()` | Service-role client (bypasses RLS) for trusted API routes |

> ⚠️ **Never import `createSupabaseServiceClient` in Client Components** — it reads `SUPABASE_SERVICE_ROLE_KEY` which must never reach the browser.

---

## Task 3: `POST /api/ingest`

### Request Processing Pipeline

```
1. request.json()            → try/catch → 400 on invalid JSON
2. ExtensionExportSchema.parse() → try/catch → 422 with Zod field errors
3. Guard: reels.length === 0  → 200 with zeroes
4. Guard: reels.length > 5000 → 413 payload too large
5. createSupabaseServiceClient() → try/catch → 500 on missing env var
6. Canonicalize: url.split('?')[0].replace(/\/$/, '') for each URL
7. [...new Set(urls)] → deduplicate within payload
8. Batch loop: 100 URLs per Supabase upsert call
   └─ onConflict: 'original_url', ignoreDuplicates: true, count: 'exact'
9. Return: { success, inserted, skipped, total, errors }
   └─ HTTP 200 on full success, 207 Multi-Status on partial failures
```

### Response Example

```json
{
  "success": true,
  "inserted": 230,
  "skipped": 17,
  "total": 247,
  "errors": []
}
```

---

## Verification Results

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | ✅ Zero errors |
| Requirements audit (75 checks) | ✅ 75/75 PASS |
| npm packages installed | ✅ `@supabase/ssr`, `@supabase/supabase-js`, `zod` |

---

## Next Steps for the User

1. Run `schema.sql` in the Supabase SQL Editor
2. Copy `dashboard/.env.local.example` → `dashboard/.env.local` and fill in credentials
3. Run `npm run dev` in `dashboard/` to start the Next.js dev server
4. POST the extension JSON export to `http://localhost:3000/api/ingest`

---

## Phase 1 (Complete)

See [Phase 1 walkthrough](file:///C:/Users/Aaditya/.gemini/antigravity-ide/brain/5778451a-a4fc-45b4-b97a-5eaa7a90df69/walkthrough.md) for the Chrome Extension extractor.
