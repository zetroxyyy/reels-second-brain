import { NextResponse } from 'next/server'
import { streamText, convertToModelMessages } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createSupabaseServiceClient } from '@/utils/supabase/server'

// Initialize the Groq provider (configured to point to Groq's custom OpenAI endpoint)
const groq = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
})

// Module-level lazy loaded extractor cache (singleton)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorCache: any = null

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 })
    }

    // Extract the latest user message
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()

    let query = ''
    if (lastUserMessage) {
      // Prioritize parts if present and not empty
      if (Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
        query = lastUserMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('')
      }
      
      // Fallback to content if query is still empty/whitespace
      if (!query.trim() && typeof lastUserMessage.content === 'string') {
        query = lastUserMessage.content
      }
    }

    let context = 'No matching context found.'

    if (query.trim()) {
      // ── 1. Generate embedding using lazy-loaded transformers singleton ──────
      let embedding: number[] = []
      try {
        if (!extractorCache) {
          const { pipeline, env } = await import('@xenova/transformers') as any
          env.allowLocalModels = false
          env.useBrowserCache = false
          
          extractorCache = await pipeline(
            'feature-extraction',
            'Xenova/nomic-embed-text-v1.5',
            { quantized: true }
          )
        }

        // Prepend the required 'search_query: ' prefix to query for nomic-embed-text compatibility
        const prefixedQuery = `search_query: ${query.trim()}`
        const output = await extractorCache(prefixedQuery, { pooling: 'mean', normalize: true })
        embedding = Array.from(output.data as Float32Array)
      } catch (err) {
        console.error('[chat-api] Embedding generation failed:', err)
      }

      // ── 2. Query Supabase match_reels RPC ────────────────────────────────────
      if (embedding.length === 768) {
        try {
          const supabase = createSupabaseServiceClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: matchedReels, error } = await (supabase as any).rpc('match_reels', {
            query_embedding:  embedding,
            match_threshold:  0.20, // Low threshold for more permissive matching in RAG chat
            match_count:      4,    // top 4 matches
          })

          if (error) {
            console.error('[chat-api] RPC error:', error)
          } else if (matchedReels && matchedReels.length > 0) {
            context = matchedReels
              .map((r: any, index: number) => {
                return `Reel #${index + 1}:
URL: ${r.original_url}
Summary: ${r.ai_summary || 'No summary available.'}
Transcript: ${r.transcript || 'No transcript available.'}
--------------------------------`
              })
              .join('\n\n')
          }
        } catch (dbErr) {
          console.error('[chat-api] Supabase search failed:', dbErr)
        }
      }
    }

    // ── 3. Call StreamText with the RAG System Prompt ────────────────────────
    const result = await streamText({
      model: groq('llama-3.1-8b-instant'),
      system: `You are an elite AI assistant for a user's Second Brain. Answer the user's question using ONLY the following context from their saved Instagram Reels. Cite the original_url when referencing a specific video. If the answer is not in the context, say you don't know. Context:\n\n${context}`,
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    })
  } catch (err: any) {
    console.error('[chat-api] Global handler exception:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error during chat.' },
      { status: 500 }
    )
  }
}
