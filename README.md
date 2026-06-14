<div align="center">

# 🎬 Reels Second Brain

**An open-source system to capture, store, and semantically search every Instagram Reel you've ever saved.**

[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](dashboard/)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome)](manifest.json)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ecf8e?logo=supabase)](schema.sql)

</div>

---

## 📖 What is this?

Instagram lets you save Reels, but gives you no way to search, organize, or rediscover them. **Reels Second Brain** fixes that.

It is a **three-phase open-source project**:

| Phase | Component | Status |
|:---:|---|:---:|
| **1** | Chrome Extension — scrapes every saved Reel URL | ✅ Complete |
| **2** | Next.js Dashboard + Supabase — stores URLs, powers the UI | ✅ Complete |
| **3** | VPS Pipeline — downloads videos, transcribes, embeds, enables semantic search | 🔜 Planned |

---

## 🗂️ Monorepo Structure

```
reels-second-brain/
│
├── 📦 Chrome Extension (Phase 1)
│   ├── manifest.json        # Manifest V3 — permissions & content script
│   ├── content.js           # HUD widget + Dynamic Delta Polling engine
│   ├── popup.html           # Toolbar popup (instructions & quick-nav)
│   ├── icons/               # Extension icons (16px, 48px, 128px)
│   └── schema.sql           # Supabase SQL — run this first
│
└── 🖥️  dashboard/           # Next.js 16 Web App (Phase 2)
    ├── app/
    │   ├── api/
    │   │   └── ingest/
    │   │       └── route.ts # POST /api/ingest — bridge from extension to DB
    │   ├── layout.tsx
    │   └── page.tsx
    ├── types/
    │   └── database.ts      # TypeScript interfaces + Zod runtime schemas
    ├── utils/
    │   └── supabase/
    │       ├── server.ts    # Cookie-aware & service-role Supabase clients
    │       └── client.ts    # Browser Supabase client
    ├── middleware.ts         # Supabase session refresh on every request
    ├── .env.local.example   # ← Copy this to .env.local and fill in secrets
    └── package.json         # next, @supabase/ssr, @supabase/supabase-js, zod
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- A **Supabase** project ([free tier works](https://supabase.com))
- **Google Chrome** (for the extension)

---

### Step 1 — Set up the Database

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Paste the contents of [`schema.sql`](schema.sql) and click **Run**

This creates the `reels` table with pgvector enabled and all indexes.

---

### Step 2 — Install the Chrome Extension

1. Go to `chrome://extensions` in Chrome
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** → select this root folder
4. The 🎬 icon appears in your toolbar

**How to use it:**
- Navigate to `instagram.com/YOUR_USERNAME/saved/all-posts/`
- The HUD widget appears in the bottom-right corner
- Click **Sync Library** and wait — it auto-scrolls and captures every Reel URL
- Click **Download JSON** when complete

---

### Step 3 — Run the Dashboard

```bash
cd dashboard

# 1. Copy the env template and fill in your Supabase credentials
cp .env.local.example .env.local

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Step 4 — Ingest Your Reels

Once the extension has finished scraping, take the downloaded JSON file and POST it to the dashboard:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d @reels-second-brain-2025-06-14.json
```

**Response:**
```json
{
  "success": true,
  "inserted": 230,
  "skipped": 17,
  "total": 247,
  "errors": []
}
```

> Re-running the same export is always safe — the upsert is idempotent.

---

## 🧠 How the Extraction Engine Works

The Chrome Extension uses a **Dynamic Delta Polling** algorithm — no hardcoded timers:

```
1. Harvest all visible /reel/ anchor tags → JavaScript Set (deduplication)
2. Scroll to the bottom of the page
3. Poll every 200ms — the moment Set.size grows, stop polling & scroll again
4. If nothing grows for 5 consecutive seconds:
   └─ Check if scrollHeight changed
       ├─ Grew → more content loading, reset and retry
       └─ Same → stall counter++  (2 stalls = truly at the end)
5. Final sweep + console.log + Download JSON button
```

This guarantees **zero missed Reels** regardless of network speed or library size.

---

## 🗄️ Database Schema

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Auto-generated primary key |
| `original_url` | `TEXT UNIQUE` | Canonical Instagram Reel URL |
| `video_path` | `TEXT` | Object-storage path (Phase 3) |
| `transcript` | `TEXT` | Speech-to-text (Phase 3) |
| `visual_description` | `TEXT` | AI visual description (Phase 3) |
| `ai_summary` | `TEXT` | Combined AI summary (Phase 3) |
| `entities` | `JSONB` | Tags, ingredients, people, topics |
| `embedding` | `vector(768)` | Semantic embedding for similarity search |
| `created_at` | `TIMESTAMPTZ` | Row creation timestamp |

---

## 🔒 Environment Variables

| Variable | Where to find it | Required |
|---|---|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | ✅ |

> ⚠️ **Never commit `.env.local`** — it is listed in `.gitignore`. Only the `.env.local.example` template is tracked.

---

## 🔌 Chrome Extension Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Interact with the current Instagram tab |
| `scripting` | Inject the HUD content script |
| `storage` | Reserved for future local caching |
| `*://*.instagram.com/*` | Host permission to run on Instagram |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Vanilla JS, Manifest V3 |
| Web Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL + pgvector) |
| Validation | Zod 4 |
| Auth | Supabase Auth + `@supabase/ssr` |

---

## 🗺️ Roadmap

- [x] **Phase 1** — Chrome Extension scraper with Dynamic Delta Polling
- [x] **Phase 2** — Next.js dashboard, Supabase schema, ingestion API
- [ ] **Phase 3** — VPS pipeline: download videos, Whisper transcription, Ollama embeddings
- [ ] **Phase 4** — Semantic search UI, tag filtering, AI-powered recommendations
- [ ] **Phase 5** — Mobile-friendly PWA interface

---

## 🤝 Contributing

This project is open-source under the MIT license. Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — free to use, modify, and distribute.
