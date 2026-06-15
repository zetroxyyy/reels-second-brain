'use client'

import { useTransition, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteReel } from '@/app/actions'

interface DeleteButtonProps {
  reelId: string
}

export default function DeleteButton({ reelId }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    if (!confirm('Delete this reel from the database?')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteReel(reelId)
      if (!result.success) {
        setError(result.error ?? 'Delete failed')
      }
    })
  }

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete reel"
        className={`
          flex items-center justify-center w-7 h-7 rounded-lg
          transition-all duration-200
          ${isPending
            ? 'bg-red-500/10 text-red-400 cursor-not-allowed opacity-50'
            : 'bg-white/[0.04] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 hover:scale-110 active:scale-95'}
        `}
      >
        {isPending ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
      {error && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-900/90 text-red-200 text-[10px] rounded whitespace-nowrap shadow-xl z-50">
          {error}
        </div>
      )}
    </div>
  )
}
