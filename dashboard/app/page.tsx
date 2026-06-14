import { createSupabaseServerClient } from '@/utils/supabase/server';
import { Search, BrainCircuit, Sparkles, Film, ExternalLink, Calendar, Database, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export default async function DashboardPage() {
  let reels: any[] = [];
  let errorMsg = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

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

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.35)]">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Reels Second Brain
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wide uppercase">Your AI Knowledge Base</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 shadow-inner text-xs font-semibold text-zinc-300">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span><strong className="text-white">{reels.length}</strong> Reels Ingested</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative">
        {/* Search Hero Area */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Search Your Second Brain
          </h2>
          <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
            Find topics, keywords, transcripts, and semantic concepts across all cached Instagram Reels.
          </p>
          
          {/* Glowing Search Bar UI */}
          <div className="relative group max-w-xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center bg-[#121214] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <Search className="w-5 h-5 text-zinc-500 ml-4 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                placeholder="Search transcripts, visual descriptions, tags..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 px-3 py-4 outline-none border-none font-medium cursor-not-allowed"
                disabled
              />
              <div className="flex items-center gap-1.5 mr-4 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-zinc-400">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>AI Search</span>
              </div>
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-200 shadow-xl max-w-xl mx-auto flex gap-4 items-start">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold mb-1">Configuration Error</h2>
              <p className="text-sm text-zinc-450">{errorMsg}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Ensure <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set up properly.
              </p>
            </div>
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Film className="w-8 h-8 text-zinc-655" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-200">No reels synced</h3>
            <p className="text-sm text-zinc-500">
              Scrape your Instagram saved page using the Chrome Extension, then send them to this database using the HUD push action.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {reels.map((reel) => {
              // Extract the shortcode or ID from URL for display
              let displayName = 'instagram.com/reel';
              try {
                const urlObj = new URL(reel.original_url);
                const pathParts = urlObj.pathname.split('/').filter(Boolean);
                const shortcode = pathParts[pathParts.length - 1];
                displayName = `reel/${shortcode || ''}`;
              } catch (e) {
                // fallback
              }

              return (
                <div
                  key={reel.id}
                  className="group relative flex flex-col h-72 rounded-2xl overflow-hidden bg-[#121214] border border-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/20 hover:shadow-[0_12px_40px_-12px_rgba(168,85,247,0.15)]"
                >
                  {/* Video Thumbnail Placeholder */}
                  <div className="flex-1 bg-black/35 flex flex-col items-center justify-center relative group-hover:bg-black/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-400 group-hover:scale-110 group-hover:border-purple-500/30 group-hover:text-purple-400 transition-all duration-300">
                      <Film className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-zinc-600 mt-3 font-semibold tracking-wider uppercase group-hover:text-zinc-500 transition-colors">
                      Video Pending VPS Download
                    </span>
                  </div>

                  {/* Card Info Details */}
                  <div className="p-4 border-t border-white/5 bg-gradient-to-b from-[#121214] to-[#0d0d0f] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-300 truncate group-hover:text-purple-400 transition-colors">
                        {displayName}
                      </span>
                      <a
                        href={reel.original_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-white transition-colors"
                        title="Open in Instagram"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-zinc-600" />
                        <span>{new Date(reel.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      {reel.entities ? (
                        <span className="flex items-center gap-1 text-emerald-450">
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
        )}
      </main>
    </div>
  );
}
