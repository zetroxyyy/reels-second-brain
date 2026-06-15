'use client'

/**
 * ReelGrid.tsx — Client Component
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all interactive UI:
 *   • Hero search bar wired to the searchReels Server Action
 *   • Dynamic category pill filters generated from entities.topic / entities.tags
 *   • Masonry-style responsive grid of reel cards
 *   • Each card shows the Instagram embed player + AI summary + metadata
 *   • Delete button per card (wired to deleteReel Server Action)
 */

import { useMemo, useState, useTransition, useRef, useCallback } from 'react'
import {
  Search, X, Loader2, Sparkles, Film, ExternalLink,
  Calendar, Tag, ChevronRight, AlertCircle,
} from 'lucide-react'
import { searchReels } from '@/app/actions'
import DeleteButton from '@/app/components/DeleteButton'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Reel {
  id: string
  original_url: string
  ai_summary: string | null
  transcript: string | null
  entities: {
    tags?: string[]
    topic?: string
    ingredients?: string[]
    people?: string[]
    language?: string
  } | null
  created_at: string
  // Present only when results come from the match_reels RPC (search results)
  similarity?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the reel shortcode from an Instagram URL (last path segment). */
function extractShortcode(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? ''
  } catch {
    return ''
  }
}

/** Build Instagram's self-contained embed iframe URL for a reel. */
function buildEmbedUrl(url: string): string {
  const shortcode = extractShortcode(url)
  if (!shortcode) return ''
  // The /embed/ endpoint serves a full standalone video player — no JS needed.
  return `https://www.instagram.com/reel/${shortcode}/embed/`
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Reel Card
// ─────────────────────────────────────────────────────────────────────────────

function ReelCard({ reel }: { reel: Reel }) {
  const shortcode  = extractShortcode(reel.original_url)
  const embedUrl   = buildEmbedUrl(reel.original_url)
  const isProcessed = Boolean(reel.ai_summary && !reel.ai_summary.startsWith('[FAILED]'))
  const isFailed    = Boolean(reel.ai_summary?.startsWith('[FAILED]'))
  const tags        = reel.entities?.tags?.slice(0, 4) ?? []
  const topic       = reel.entities?.topic ?? ''

  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#111113] border border-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/25 hover:shadow-[0_16px_48px_-12px_rgba(168,85,247,0.2)]">

      {/* ── Instagram Embed / Placeholder ────────────────────────────────── */}
      {isProcessed && embedUrl ? (
        /* Processed: show the real Instagram Reel embed player */
        <div className="relative w-full bg-black" style={{ paddingBottom: '177.78%' /* 9:16 */ }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={`Instagram Reel ${shortcode}`}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        /* Pending / failed: elegant dark placeholder */
        <div className="flex flex-col items-center justify-center bg-black/40 py-14 gap-3 relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.01)_10px,rgba(255,255,255,0.01)_20px)]" />
          <div className={`
            w-14 h-14 rounded-2xl flex items-center justify-center z-10
            ${isFailed
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-white/[0.03] border border-white/10 text-zinc-500 group-hover:border-purple-500/30 group-hover:text-purple-400 group-hover:scale-110 transition-all duration-300'}
          `}>
            <Film className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase z-10 text-zinc-600">
            {isFailed ? 'Download failed' : 'Processing queue'}
          </span>
        </div>
      )}

      {/* ── Card Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 border-t border-white/5 bg-gradient-to-b from-[#111113] to-[#0d0d0f]">

        {/* URL row + action icons */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-bold text-zinc-400 truncate group-hover:text-purple-400 transition-colors flex-1 min-w-0">
            {shortcode ? `reel/${shortcode}` : reel.original_url}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={reel.original_url}
              target="_blank"
              rel="noreferrer"
              id={`open-reel-${shortcode || reel.id}`}
              title="Open in Instagram"
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <DeleteButton reelId={reel.id} />
          </div>
        </div>

        {/* Similarity badge (search results only) */}
        {reel.similarity !== undefined && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1 w-fit">
            <Sparkles className="w-3 h-3" />
            {(reel.similarity * 100).toFixed(0)}% match
          </div>
        )}

        {/* AI Summary */}
        {isProcessed && reel.ai_summary && (
          <p className="text-[12px] text-zinc-300 leading-relaxed line-clamp-4 font-medium">
            {reel.ai_summary}
          </p>
        )}

        {/* Tags */}
        {(tags.length > 0 || topic) && (
          <div className="flex flex-wrap gap-1.5">
            {topic && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold">
                {topic}
              </span>
            )}
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/8 text-zinc-400 text-[10px] font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Date + status row */}
        <div className="flex items-center justify-between text-[11px] text-zinc-600 font-medium mt-0.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>
              {new Date(reel.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          {isProcessed ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              AI Scanned
            </span>
          ) : isFailed ? (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Failed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
              Queued
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ReelGrid Component
// ─────────────────────────────────────────────────────────────────────────────

interface ReelGridProps {
  initialReels: Reel[]
}

export default function ReelGrid({ initialReels }: ReelGridProps) {
  // ── Search state ────────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Reel[] | null>(null)
  const [searchError,   setSearchError]   = useState<string | null>(null)
  const [isSearching,   startSearch]      = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Category filter state ───────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // ── Derive the flat list of unique category labels ──────────────────────────
  // We collect both `entities.topic` and `entities.tags[]` from every reel,
  // deduplicate, sort by frequency, and cap at 24 pills.
  const categories = useMemo(() => {
    const freq = new Map<string, number>()
    initialReels.forEach((r) => {
      const bump = (label: string) => {
        const k = label.toLowerCase().trim()
        if (k) freq.set(k, (freq.get(k) ?? 0) + 1)
      }
      if (r.entities?.topic) bump(r.entities.topic)
      r.entities?.tags?.forEach(bump)
    })
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])   // most-common first
      .slice(0, 24)
      .map(([label]) => label)
  }, [initialReels])

  // ── Determine the displayed reel list ────────────────────────────────────────
  // Priority: search results > all reels, then category filter applied on top.
  const displayedReels = useMemo(() => {
    const base = searchResults ?? initialReels
    if (!activeCategory) return base
    return base.filter((r) => {
      const t = r.entities?.topic?.toLowerCase().trim()
      const tags = r.entities?.tags?.map((x) => x.toLowerCase().trim()) ?? []
      return t === activeCategory || tags.includes(activeCategory)
    })
  }, [initialReels, searchResults, activeCategory])

  // ── Search handler ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults(null)
      setSearchError(null)
      return
    }
    setSearchError(null)
    setActiveCategory(null)   // clear category filter when searching
    startSearch(async () => {
      try {
        const results = await searchReels(q)
        setSearchResults(results as Reel[])
      } catch (err: any) {
        setSearchError(err?.message ?? 'Search failed.')
        setSearchResults(null)
      }
    })
  }, [searchQuery])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults(null)
    setSearchError(null)
    inputRef.current?.focus()
  }, [])

  const isInSearchMode = searchResults !== null || isSearching

  return (
    <div className="space-y-8">

      {/* ── Hero Search Bar ───────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          Search Your Second Brain
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          AI-powered semantic search across all your saved Reels — transcripts, summaries, ingredients, topics.
        </p>

        {/* Search input */}
        <div className="relative group max-w-xl mx-auto">
          {/* Glow ring */}
          <div className="absolute -inset-px bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-0 group-focus-within:opacity-50 transition-opacity duration-300 pointer-events-none" />
          <div className="relative flex items-center bg-[#0f0f11] border border-white/10 rounded-xl overflow-hidden shadow-2xl group-focus-within:border-purple-500/40 transition-colors">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-purple-400 ml-4 flex-shrink-0 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-zinc-500 ml-4 flex-shrink-0 group-focus-within:text-purple-400 transition-colors" />
            )}
            <input
              ref={inputRef}
              type="text"
              id="semantic-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Try: 'pasta recipe', 'travel in Japan', 'Python tutorial'…"
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 px-3 py-4 outline-none border-none font-medium"
            />
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mr-2 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_16px_rgba(168,85,247,0.4)] transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Search
            </button>
          </div>
        </div>

        {/* Search error */}
        {searchError && (
          <div className="flex items-center gap-2 justify-center text-sm text-red-400 bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* ── Category Filter Pills ─────────────────────────────────────────── */}
      {categories.length > 0 && !isInSearchMode && (
        <div className="flex flex-wrap gap-2 justify-center">
          {/* "All" pill */}
          <button
            onClick={() => setActiveCategory(null)}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border
              ${!activeCategory
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 hover:border-white/15'}
            `}
          >
            All ({initialReels.length})
          </button>
          {categories.map((cat) => {
            const count = initialReels.filter((r) => {
              const t = r.entities?.topic?.toLowerCase().trim()
              const tags = r.entities?.tags?.map((x) => x.toLowerCase().trim()) ?? []
              return t === cat || tags.includes(cat)
            }).length
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border
                  ${activeCategory === cat
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : 'bg-white/[0.04] border-white/8 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 hover:border-white/15'}
                `}
              >
                <Tag className="w-3 h-3 opacity-60" />
                {cat}
                <span className="opacity-50">({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search Mode Header ─────────────────────────────────────────────── */}
      {isInSearchMode && !isSearching && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-zinc-400">
            {searchResults?.length === 0
              ? 'No results found.'
              : <><span className="font-bold text-white">{searchResults?.length}</span> semantic matches for <span className="text-purple-300 font-semibold">"{searchQuery}"</span></>
            }
          </p>
          <button
            onClick={clearSearch}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear search
          </button>
        </div>
      )}

      {/* Active category label */}
      {activeCategory && !isInSearchMode && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-zinc-400">
            <span className="text-white font-bold">{displayedReels.length}</span> reels tagged{' '}
            <span className="text-purple-300 font-semibold">#{activeCategory}</span>
          </p>
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear filter
          </button>
        </div>
      )}

      {/* ── Reel Grid ─────────────────────────────────────────────────────── */}
      {isSearching ? (
        /* Search in progress skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : displayedReels.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-5">
            {isInSearchMode
              ? <Search className="w-7 h-7 text-zinc-600" />
              : <Film className="w-7 h-7 text-zinc-600" />}
          </div>
          <h3 className="text-base font-bold text-zinc-200 mb-2">
            {isInSearchMode ? 'No matching reels' : activeCategory ? 'No reels in this category' : 'No reels synced yet'}
          </h3>
          <p className="text-sm text-zinc-500">
            {isInSearchMode
              ? 'Try a different query, or wait for the VPS worker to process more reels.'
              : 'Use the Chrome extension to scrape your Saved page.'}
          </p>
        </div>
      ) : (
        /* The grid itself */
        <>
          {!isInSearchMode && !activeCategory && (
            <p className="text-xs text-zinc-600 font-semibold tracking-wide px-1">
              ALL REELS — {initialReels.length} total
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {displayedReels.map((reel) => (
              <ReelCard key={reel.id} reel={reel} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
