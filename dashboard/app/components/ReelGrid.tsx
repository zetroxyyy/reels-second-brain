'use client'

/**
 * ReelGrid.tsx — Client Component
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles category filter pills and dynamic masonry-style grid layout.
 * Video embeds are replaced by sleek minimalist text cards.
 */

import { useMemo, useState } from 'react'
import {
  Film, ExternalLink, Calendar, Tag, X, Sparkles
} from 'lucide-react'
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
  similarity?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the reel shortcode from an Instagram URL. */
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
        
        {/* Similarity badge (reused if RAG search is added in the grid later) */}
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
  // ── Category filter state ───────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // ── Derive the list of unique category labels ──────────────────────────────
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
      .sort((a, b) => b[1] - a[1]) // most-common first
      .slice(0, 24)
      .map(([label]) => label)
  }, [initialReels])

  // ── Determine the displayed reel list ────────────────────────────────────────
  const displayedReels = useMemo(() => {
    if (!activeCategory) return initialReels
    return initialReels.filter((r) => {
      const t = r.entities?.topic?.toLowerCase().trim()
      const tags = r.entities?.tags?.map((x) => x.toLowerCase().trim()) ?? []
      return t === activeCategory || tags.includes(activeCategory)
    })
  }, [initialReels, activeCategory])

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* ── Category Filter Pills ─────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto px-4">
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

      {/* Active category label */}
      {activeCategory && (
        <div className="flex items-center justify-between px-1 max-w-7xl mx-auto">
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
      {displayedReels.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-5">
            <Film className="w-7 h-7 text-zinc-600" />
          </div>
          <h3 className="text-base font-bold text-zinc-200 mb-2">
            {activeCategory ? 'No reels in this category' : 'No reels synced yet'}
          </h3>
          <p className="text-sm text-zinc-500">
            {activeCategory
              ? 'Try selecting a different category pill.'
              : 'Use the Chrome extension to scrape your Saved page.'}
          </p>
        </div>
      ) : (
        /* The grid itself */
        <>
          {!activeCategory && (
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
