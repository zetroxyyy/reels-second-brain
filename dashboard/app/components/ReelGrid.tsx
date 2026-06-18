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

import { useMemo, useState, useTransition, useRef, useCallback, useEffect } from 'react'
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

// ─────────────────────────────────────────────────────────────────────────────
// Individual Reel Card
// ─────────────────────────────────────────────────────────────────────────────

function ReelCard({ reel }: { reel: Reel }) {
  const shortcode  = extractShortcode(reel.original_url)
  const isProcessed = Boolean(reel.ai_summary && !reel.ai_summary.startsWith('[FAILED]'))
  const isFailed    = Boolean(reel.ai_summary?.startsWith('[FAILED]'))
  const tags        = reel.entities?.tags?.slice(0, 4) ?? []
  const topic       = reel.entities?.topic ?? ''

  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden bg-gradient-to-b from-[#111113] to-[#09090b] border border-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/10">
      
      {/* Sleek Minimalist Card Header */}
      <div className="flex items-center justify-between p-4 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
            ${isFailed 
              ? 'bg-red-500/10 text-red-400' 
              : isProcessed 
                ? 'bg-purple-500/10 text-purple-400' 
                : 'bg-zinc-500/10 text-zinc-400 animate-pulse'}
          `}>
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <a 
              href={reel.original_url}
              target="_blank"
              rel="noreferrer"
              title="Open Reel in Instagram"
              className="text-xs font-mono font-bold text-zinc-200 hover:text-purple-400 transition-colors truncate block"
            >
              {shortcode ? `reel/${shortcode}` : 'View Instagram Reel'}
            </a>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {new Date(reel.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

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

      {/* ── Card Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-[#111113] to-[#0d0d0f]">
        
        {/* Similarity badge (search results only) */}
        {reel.similarity !== undefined && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1 w-fit">
            <Sparkles className="w-3 h-3" />
            {(reel.similarity * 100).toFixed(0)}% match
          </div>
        )}

        {/* Status indicator badge if pending/failed/processing */}
        {!isProcessed && (
          <div className="flex items-center gap-1.5 text-[10px] font-medium mt-1">
            {isFailed ? (
              <span className="flex items-center gap-1.5 text-red-400 bg-red-500/5 border border-red-500/10 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                AI Analysis Failed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-purple-400 bg-purple-500/5 border border-purple-500/10 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
                Processing Queue
              </span>
            )}
          </div>
        )}

        {/* AI Summary */}
        {isProcessed && reel.ai_summary && (
          <p className="text-[12px] text-zinc-300 leading-relaxed font-medium line-clamp-3">
            {reel.ai_summary}
          </p>
        )}

        {/* Tags */}
        {(tags.length > 0 || topic) && (
          <div className="flex flex-wrap gap-1.5 mt-1">
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
  const handleSearch = useCallback((query: string) => {
    const q = query.trim()
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
  }, [])

  // Live search as user types, with a 500ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

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
        <div className="relative group max-w-2xl mx-auto">
          {/* Subtle ambient glow behind input */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-lg opacity-75 group-focus-within:opacity-100 transition duration-500" />
          <div className="relative flex items-center bg-[#09090b]/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl group-focus-within:border-purple-500/40 group-focus-within:ring-4 group-focus-within:ring-purple-500/10 transition-all duration-300">
            {isSearching ? (
              <Loader2 className="w-5.5 h-5.5 text-purple-400 ml-4.5 flex-shrink-0 animate-spin" />
            ) : (
              <Search className="w-5.5 h-5.5 text-zinc-500 ml-4.5 flex-shrink-0 group-focus-within:text-purple-400 transition-colors" />
            )}
            <input
              ref={inputRef}
              type="text"
              id="semantic-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder="Search concepts: 'pasta recipe', 'Japan travel', 'Python tutorial'…"
              className="flex-1 bg-transparent text-base text-white placeholder-zinc-500 focus:placeholder-zinc-600 px-4 py-4.5 outline-none border-none font-medium transition-all"
            />
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mr-2.5 p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Search button */}
            <button
              onClick={() => handleSearch(searchQuery)}
              disabled={isSearching || !searchQuery.trim()}
              className="mr-3.5 flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold hover:scale-102 hover:shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all active:scale-98 disabled:opacity-40 disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
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
        <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto px-4">
          {/* "All" pill */}
          <button
            onClick={() => setActiveCategory(null)}
            className={`
              px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border
              ${!activeCategory
                ? 'bg-white border-white text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:bg-zinc-100'
                : 'bg-transparent border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.03]'}
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
                  flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border
                  ${activeCategory === cat
                    ? 'bg-purple-500 border-purple-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.25)]'
                    : 'bg-transparent border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.03]'}
                `}
              >
                <Tag className="w-3.5 h-3.5 opacity-60" />
                <span className="capitalize">{cat}</span>
                <span className="opacity-50 text-[10px]">({count})</span>
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
