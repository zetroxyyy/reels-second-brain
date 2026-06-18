'use client'

import { useTransition, useState } from 'react'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'
import { retryFailedReels } from '@/app/actions'

interface RetryButtonProps {
  failedCount: number
}

export default function RetryButton({ failedCount }: RetryButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRetry = () => {
    setStatus('idle')
    setErrorMsg(null)

    startTransition(async () => {
      const result = await retryFailedReels()
      if (result.success) {
        setStatus('success')
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('error')
        setErrorMsg(result.error ?? 'Failed to retry.')
        setTimeout(() => setStatus('idle'), 4000)
      }
    })
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={handleRetry}
        disabled={isPending}
        title={`Retry processing ${failedCount} failed reel(s)`}
        className={`
          flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
          transition-all duration-200 active:scale-95 flex-shrink-0 border
          ${status === 'success'
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            : status === 'error'
              ? 'bg-red-500/15 border-red-500/25 text-red-400'
              : 'bg-red-500/[0.06] hover:bg-red-500/[0.12] border-red-500/15 text-red-300 hover:text-red-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'}
        `}
      >
        {isPending ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : status === 'success' ? (
          <Check className="w-4 h-4" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {status === 'success' ? 'Resetting...' : status === 'error' ? 'Error' : `Retry ${failedCount} Failed`}
      </button>

      {status === 'error' && errorMsg && (
        <p className="absolute top-full right-0 mt-1.5 text-[10px] text-red-400 bg-black/85 px-2.5 py-1.5 rounded-lg border border-red-500/20 z-50 whitespace-nowrap">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
