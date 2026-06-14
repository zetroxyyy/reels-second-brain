import { createSupabaseServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export default async function DashboardPage() {
  // We use the service client here to bypass RLS since there's no UI auth yet.
  // In a multi-tenant app, you'd use createSupabaseServerClient() instead.
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
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              🎬
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Reels Second Brain</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-purple-400">{reels.length}</span> Reels Ingested
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {errorMsg ? (
          <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200">
            <h2 className="text-lg font-semibold mb-2">Configuration Error</h2>
            <p>{errorMsg}</p>
            <p className="mt-4 text-sm text-red-300">
              Did you add <code className="bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-black/30 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel?
            </p>
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 text-2xl">
              📭
            </div>
            <h2 className="text-2xl font-medium mb-3">No reels found</h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              You haven't ingested any reels yet. Use the Chrome Extension to scrape your Instagram saved page, then send the JSON export to the API.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {reels.map((reel) => (
              <a
                key={reel.id}
                href={reel.original_url}
                target="_blank"
                rel="noreferrer"
                className="group relative flex flex-col h-64 rounded-2xl overflow-hidden bg-white/5 border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_10px_30px_-10px_rgba(168,85,247,0.2)]"
              >
                {/* Placeholder for Video Thumbnail (Phase 3) */}
                <div className="flex-1 bg-black/40 flex items-center justify-center text-white/20 transition-colors group-hover:text-white/40">
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                
                {/* Meta details */}
                <div className="p-4 border-t border-white/5 backdrop-blur-sm">
                  <p className="text-xs text-zinc-400 font-mono truncate mb-1">
                    {new URL(reel.original_url).pathname.split('/').filter(Boolean).pop()}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {new Date(reel.created_at).toLocaleDateString()}
                    </span>
                    {reel.entities && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Processed" />
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
