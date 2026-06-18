import { BrainCircuit, Film, Database } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans overflow-x-hidden selection:bg-purple-500/30">
      {/* Background Decorative Glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse" />
      <div className="fixed top-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-pulse">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-300 to-pink-400 bg-[length:200%_auto] animate-gradient-text bg-clip-text text-transparent leading-none">
                Reels Second Brain
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wide uppercase mt-0.5">
                AI Reels Knowledge Base
              </p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats badges Skeleton */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-xs font-semibold text-zinc-500">
              <Database className="w-3.5 h-3.5 text-zinc-600" />
              <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-xs font-semibold text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
              <div className="h-3.5 w-16 bg-white/5 rounded animate-pulse" />
            </div>
          </div>

          {/* Action buttons Skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-24 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
            <div className="h-9 w-28 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* Category Pills Skeleton */}
        <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto px-4">
          <div className="h-8 w-16 bg-white border border-white rounded-full opacity-80 shadow-[0_4px_20px_rgba(255,255,255,0.15)] animate-pulse" />
          <div className="h-8 w-24 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-20 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-28 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-16 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-white/5 border border-white/10 rounded-full animate-pulse" />
          <div className="h-8 w-20 bg-white/5 border border-white/10 rounded-full animate-pulse" />
        </div>

        {/* All Reels Header Skeleton */}
        <div className="h-3 w-36 bg-zinc-800/80 rounded animate-pulse px-1" />

        {/* Minimalist Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl overflow-hidden bg-gradient-to-b from-[#111113] to-[#09090b] border border-white/5 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Card Header Skeleton */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/10 text-zinc-500/40 flex items-center justify-center flex-shrink-0">
                    <Film className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="h-3 w-24 bg-white/5 rounded" />
                    <div className="h-2 w-16 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04]" />
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04]" />
                </div>
              </div>

              {/* Card Body Skeleton */}
              <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-[#111113] to-[#0d0d0f]">
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/5 rounded" />
                  <div className="h-3 w-11/12 bg-white/5 rounded" />
                  <div className="h-3 w-4/5 bg-white/5 rounded" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <div className="h-5 w-12 bg-white/[0.04] border border-white/5 rounded-full" />
                  <div className="h-5 w-16 bg-white/[0.04] border border-white/5 rounded-full" />
                  <div className="h-5 w-14 bg-white/[0.04] border border-white/5 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
