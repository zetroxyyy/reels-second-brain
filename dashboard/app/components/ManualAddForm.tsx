'use client'

import { useTransition, useState, useRef } from 'react'
import { Plus, Loader2, Check, AlertCircle, Link } from 'lucide-react'
import { manualIngest } from '@/app/actions'

export default function ManualAddForm() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const url = inputRef.current?.value?.trim() ?? ''
    if (!url) return

    setStatus('idle')
    setErrorMsg(null)

    startTransition(async () => {
      const result = await manualIngest(url)
      if (result.success) {
        setStatus('success')
        if (inputRef.current) inputRef.current.value = ''
        // reset to idle after 2.5 s
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('error')
        setErrorMsg(result.error ?? 'Failed to add reel.')
        setTimeout(() => setStatus('idle'), 4000)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative group">
        {/* Glow on focus */}
        <div className="absolute -inset-px bg-gradient-to-r from-purple-600/40 to-pink-600/40 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="relative flex items-center bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
          <Link className="w-4 h-4 text-zinc-500 ml-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="url"
            placeholder="Paste Instagram URL…"
            disabled={isPending}
            className="w-52 bg-transparent text-sm text-white placeholder-zinc-600 px-3 py-2.5 outline-none border-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`
          flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
          transition-all duration-200 active:scale-95 flex-shrink-0
          ${status === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
            : status === 'error'
              ? 'bg-red-500/15 border border-red-500/25 text-red-400'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'}
        `}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'success' ? (
          <Check className="w-4 h-4" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {status === 'success' ? 'Added!' : status === 'error' ? 'Error' : 'Add'}
      </button>

      {/* Error tooltip */}
      {status === 'error' && errorMsg && (
        <p className="text-[11px] text-red-400 max-w-[180px] leading-tight">{errorMsg}</p>
      )}
    </form>
  )
}
