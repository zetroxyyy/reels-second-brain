'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { MessageSquare, X, Send, Sparkles, User, BrainCircuit } from 'lucide-react'

// Render URL citations as external links
function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = content.split(urlRegex)
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      let display = part
      if (part.includes('instagram.com/reel/')) {
        try {
          const u = new URL(part)
          const paths = u.pathname.split('/').filter(Boolean)
          const shortcode = paths[paths.length - 1]
          if (shortcode) {
            display = `reel/${shortcode}`
          }
        } catch {
          // ignore
        }
      }
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-purple-400 hover:text-purple-300 underline font-semibold transition-colors break-all inline-flex items-center gap-0.5"
        >
          {display}
        </a>
      )
    }
    return part
  })
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  
  const { messages, sendMessage, status, error } = useChat()

  const isLoading = status === 'submitted' || status === 'streaming'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    sendMessage({ text: trimmed })
    setInput('')
  }

  // Extract text content from message parts
  const getMessageText = (message: any) => {
    if (!message.parts || !Array.isArray(message.parts)) return ''
    return message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('')
  }

  return (
    <>
      {/* ── Floating Action Button ────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-[0_4px_25px_rgba(168,85,247,0.45)] hover:scale-110 active:scale-95 transition-all duration-300 hover:shadow-[0_4px_30px_rgba(168,85,247,0.65)] hover:rotate-6 border border-white/10"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 h-[500px] w-96 max-w-[calc(100vw-2rem)] backdrop-blur-2xl bg-black/80 border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden flex flex-col transition-all duration-300 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-100">AI Second Brain</h3>
                <p className="text-[9px] text-zinc-500 font-semibold tracking-wide uppercase leading-none mt-0.5">
                  RAG Knowledge Assistant
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                  <BrainCircuit className="w-6 h-6 text-purple-400 opacity-60" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-300">Ask your Reels Second Brain</h4>
                  <p className="text-[11px] text-zinc-500 max-w-[200px] mt-1 leading-relaxed">
                    Query transcripts, concepts, tags, and recipes stored across all synced reels.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2.5 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Left avatar for assistant */}
                  {message.role !== 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BrainCircuit className="w-4 h-4 text-purple-400" />
                    </div>
                  )}

                  <div
                    className={`
                      text-xs px-4 py-2.5 rounded-2xl max-w-[80%] leading-relaxed font-medium
                      ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(147,51,234,0.15)]'
                          : 'bg-white/[0.04] border border-white/5 text-zinc-200 rounded-tl-none'
                      }
                    `}
                  >
                    {renderMessageContent(getMessageText(message))}
                  </div>

                  {/* Right avatar for user */}
                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-purple-300" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BrainCircuit className="w-4 h-4 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="bg-white/[0.04] border border-white/5 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[80%] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 text-[10px] text-center font-medium animate-pulse">
                Error during response stream. Please try again.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/5 bg-white/[0.01] flex items-center gap-2 flex-shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your reels..."
              disabled={isLoading}
              className="flex-1 min-w-0 bg-white/[0.03] border border-white/5 focus:border-purple-500/30 focus:bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all duration-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.02] text-white disabled:text-zinc-600 shadow-[0_2px_8px_rgba(147,51,234,0.3)] hover:scale-105 active:scale-95 disabled:scale-100 disabled:shadow-none transition-all duration-200"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
