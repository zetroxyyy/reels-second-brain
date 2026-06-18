import { createSupabaseServiceClient } from '@/utils/supabase/server';
import {
  BrainCircuit, Database, AlertCircle,
} from 'lucide-react';
import ManualAddForm from '@/app/components/ManualAddForm';
import ReelGrid from '@/app/components/ReelGrid';
import RetryButton from '@/app/components/RetryButton';

// Always render fresh on every request so category pills and counts reflect
// the current state of the database (e.g. after a new reel is processed).
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let reels: any[] = [];
  let errorMsg: string | null = null;

  try {
    const supabase = createSupabaseServiceClient();
    // Fetch ALL reels — the client-side ReelGrid handles filtering + display.
    // We select every column so the card can show the summary, tags, etc.
    const { data, error } = await supabase
      .from('reels')
      .select('id, original_url, ai_summary, transcript, entities, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      errorMsg = error.message;
    } else {
      reels = data || [];
    }
  } catch (err: any) {
    errorMsg =
      err.message ||
      'Failed to connect to Supabase. Check your environment variables.';
  }

  // Counters for the status badge
  const processedCount = reels.filter(
    (r) => r.ai_summary && !r.ai_summary.startsWith('[FAILED]')
  ).length;

  const failedCount = reels.filter(
    (r) => r.ai_summary && r.ai_summary.startsWith('[FAILED]')
  ).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      {/* Background decorative glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-300 to-pink-400 bg-[length:200%_auto] animate-gradient-text bg-clip-text text-transparent leading-none">
                Reels Second Brain
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wide uppercase mt-0.5">
                Phase 4 — Semantic Search
              </p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats badges */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-xs font-semibold text-zinc-300">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>
                <strong className="text-white">{reels.length}</strong> ingested
              </span>
            </div>
            {processedCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/[0.06] border border-emerald-500/15 text-xs font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span>
                  <strong className="text-emerald-200">{processedCount}</strong> AI-ready
                </span>
              </div>
            )}
          </div>

          {/* Action forms/buttons */}
          <div className="flex items-center gap-3">
            {failedCount > 0 && <RetryButton failedCount={failedCount} />}
            <ManualAddForm />
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-10 relative">

        {errorMsg ? (
          /* Configuration / connection error */
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-200 shadow-xl max-w-xl mx-auto flex gap-4 items-start mt-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold mb-1">Configuration Error</h2>
              <p className="text-sm opacity-80">{errorMsg}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Ensure{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                and{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded text-red-300">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{' '}
                are set in Vercel environment variables.
              </p>
            </div>
          </div>
        ) : (
          /*
           * ReelGrid handles everything from here:
           *   • Hero semantic search bar
           *   • Dynamic category pill filters
           *   • The responsive masonry grid
           *   • Individual reel cards (embed + summary + delete)
           */
          <ReelGrid initialReels={reels} />
        )}
      </main>
    </div>
  );
}
