import { createSupabaseServiceClient } from '@/utils/supabase/server';
import {
  Search, BrainCircuit, Sparkles, Film, ExternalLink,
  Calendar, Database, AlertCircle,
} from 'lucide-react';
import DeleteButton from '@/app/components/DeleteButton';
import ManualAddForm from '@/app/components/ManualAddForm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let reels: any[] = [];
  let errorMsg = null;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      errorMsg = error.message;
    } else {
      reels = data || [];
    }
  } catch (err: any) {
    errorMsg = err.message || 'Failed to connect to Supabase. Check your Environment Variables.';
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.35)]">
              <BrainCircuit className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent leading-none">
                Reels Second Brain
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wide uppercase mt-0.5">
                AI Knowledge Base
              </p>
            </div>
          </div>

          {/* ── Centre: Search Bar ────────────────────────────────────────── */}
          <div className="flex-1 mx-4 max-w-2xl relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="relative flex items-center bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
              <Search className="w-4 h-4 text-zinc-500 ml-3 flex-shrink-0 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                id="search-bar"
                placeholder="Search transcripts, tags, semantic concepts…"
                disabled
                className="w-full bg-transparent text-sm text-white placeholder-zinc-600 px-3 py-2.5 outline-none border-none font-medium cursor-not-allowed"
              />
              <div className="flex items-center gap-1.5 mr-3 px-2 py-1 rounded-md bg-white/5 border border-white/8 text-[10px] font-semibold text-zinc-500 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>AI Search</span>
              </div>
            </div>
          </div>

          {/* ── Right: Stats + Manual Add ─────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Reel counter badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 shadow-inner text-xs font-semibold text-zinc-300">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span><strong className="text-white">{reels.length}</strong> Reels</span>
            </div>

            {/* Manual Add Form */}
            <ManualAddForm />
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-10 relative">

        {/* Hero search area (larger, centred) */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-3xl font-extrabold tracking-tight mb-3 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Search Your Second Brain
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Find topics, keywords, transcripts, and semantic concepts across all cached Instagram Reels.
          </p>
        </div>

        {/* ── Error State ─────────────────────────────────────────────────── */}
        {errorMsg ? (
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-200 shadow-xl max-w-xl mx-auto flex gap-4 items-start">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold mb-1">Configuration Error</h2>
              <p className="text-sm text-zinc-450">{errorMsg}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Ensure{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
                and{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
                are set up properly.
              </p>
            </div>
          </div>
        ) : reels.length === 0 ? (
          /* ── Empty State ──────────────────────────────────────────────── */
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Film className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-200">No reels synced yet</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Scrape your Instagram Saved page using the Chrome Extension, then click{' '}
              <strong className="text-zinc-400">Push to DB</strong> in the HUD. Or paste a URL in the top bar.
            </p>
          </div>
        ) : (
          /* ── Reel Grid ───────────────────────────────────────────────── */
          <>
            <p className="text-xs text-zinc-500 font-semibold mb-6 tracking-wide">
              ALL REELS — {reels.length} total
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {reels.map((reel) => {
                let displayName = 'instagram.com/reel';
                let shortcode = '';
                try {
                  const urlObj = new URL(reel.original_url);
                  const pathParts = urlObj.pathname.split('/').filter(Boolean);
                  shortcode = pathParts[pathParts.length - 1];
                  displayName = `reel/${shortcode}`;
                } catch {
                  // fallback to raw URL
                }

                return (
                  <div
                    key={reel.id}
                    className="group relative flex flex-col h-72 rounded-2xl overflow-hidden bg-[#121214] border border-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/20 hover:shadow-[0_12px_40px_-12px_rgba(168,85,247,0.18)]"
                  >
                    {/* Video Thumbnail Placeholder */}
                    <div className="flex-1 bg-black/30 flex flex-col items-center justify-center relative group-hover:bg-black/20 transition-colors">
                      {/* Subtle gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
                      <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-500 group-hover:scale-110 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all duration-300 z-10">
                        <Film className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] text-zinc-600 mt-3 font-semibold tracking-wider uppercase group-hover:text-zinc-500 transition-colors z-10">
                        Video Pending VPS Download
                      </span>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 border-t border-white/5 bg-gradient-to-b from-[#121214] to-[#0d0d0f] flex flex-col gap-2.5">
                      {/* URL + actions row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-300 truncate group-hover:text-purple-400 transition-colors flex-1 min-w-0">
                          {displayName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Open in Instagram */}
                          <a
                            href={reel.original_url}
                            target="_blank"
                            rel="noreferrer"
                            id={`open-reel-${shortcode || reel.id}`}
                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Open in Instagram"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {/* Delete */}
                          <DeleteButton reelId={reel.id} />
                        </div>
                      </div>

                      {/* Date + AI status row */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>
                            {new Date(reel.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {reel.entities ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                            <span>AI Scanned</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-purple-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(167,139,250,0.6)] animate-pulse" />
                            <span>Queued</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
