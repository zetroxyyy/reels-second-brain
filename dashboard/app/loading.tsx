import { BrainCircuit, Film, Search } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans overflow-x-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-zinc-655" />
            </div>
            <div>
              <div className="h-5 w-36 bg-white/5 rounded-md animate-pulse" />
              <div className="h-3 w-24 bg-white/5 rounded-md animate-pulse mt-1.5" />
            </div>
          </div>
          <div className="h-8 w-28 bg-white/5 rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Search Hero Area */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="h-8 w-64 bg-white/5 rounded-md animate-pulse mx-auto mb-4" />
          <div className="h-4 w-96 bg-white/5 rounded-md animate-pulse mx-auto mb-8" />
          
          <div className="relative max-w-xl mx-auto">
            <div className="relative flex items-center bg-[#121214] border border-white/10 rounded-xl overflow-hidden py-4 px-4 gap-3">
              <Search className="w-5 h-5 text-zinc-655" />
              <div className="h-4 w-60 bg-white/5 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col h-72 rounded-2xl overflow-hidden bg-[#121214] border border-white/5 animate-pulse"
            >
              <div className="flex-1 bg-black/20 flex flex-col items-center justify-center">
                <Film className="w-5 h-5 text-zinc-800" />
              </div>
              <div className="p-4 border-t border-white/5 flex flex-col gap-3">
                <div className="h-4 w-3/4 bg-white/5 rounded-md" />
                <div className="flex justify-between items-center">
                  <div className="h-3 w-1/3 bg-white/5 rounded-md" />
                  <div className="h-3 w-1/4 bg-white/5 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
