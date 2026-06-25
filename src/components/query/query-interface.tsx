'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, Loader2, Copy, Check, MessageSquare, FileText,
  ThumbsUp, ThumbsDown, Share2, Download, Lock, Users
} from 'lucide-react'
import type { Profile } from '@/lib/db/schema'

interface QueryInterfaceProps {
  user?: { id: string; email?: string } | null
  profile?: Profile | null
  initialQuery?: string
}

interface QueryResult {
  query_id: string
  rights_response?: string
  letter_response?: string
  cited_articles: string[]
  language: string
  latency_ms: number
  rate_limit?: { remaining: number; limit: number }
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tw', label: 'Twi', flag: '🇬🇭' },
  { code: 'ga', label: 'Ga', flag: '🇬🇭' },
]

const MAX_CHARS = 2000

export function QueryInterface({ user, profile, initialQuery }: QueryInterfaceProps) {
  const [inputText, setInputText] = useState(initialQuery ?? '')
  const [selectedLang, setSelectedLang] = useState<'en' | 'tw' | 'ga'>(
    (profile?.preferredLanguage as 'en' | 'tw' | 'ga') ?? 'en'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedRights, setCopiedRights] = useState(false)
  const [copiedLetter, setCopiedLetter] = useState(false)
  const [satisfaction, setSatisfaction] = useState<boolean | null>(null)
  const [showLetter, setShowLetter] = useState(false)
  const [letterLoading, setLetterLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const isPro = profile?.subscriptionTier === 'pro' || profile?.role === 'admin' || profile?.role === 'lawyer'

  // Auto-submit if initialQuery provided
  useEffect(() => {
    if (initialQuery && initialQuery.length > 10) {
      handleSubmit()
    }
  }, [])

  const handleSubmit = async (mode: 'rights' | 'both' = 'rights') => {
    if (!inputText.trim() || isLoading) return
    if (inputText.trim().length < 10) {
      setError('Please describe your situation in more detail (at least 10 characters).')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setSatisfaction(null)
    setShowLetter(false)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_text: inputText.trim(),
          language: selectedLang,
          mode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError(`Daily limit reached (${data.limit} queries/day). ${!user ? 'Sign up for more.' : 'Upgrade to Pro for unlimited access.'}`)
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.')
        }
        return
      }

      setResult(data as QueryResult)
      // Scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateLetter = async () => {
    if (!result || letterLoading) return
    setLetterLoading(true)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_text: inputText.trim(),
          language: selectedLang,
          mode: 'letter',
        }),
      })
      const data = await res.json()
      if (res.ok && data.letter_response) {
        setResult(prev => prev ? { ...prev, letter_response: data.letter_response } : prev)
        setShowLetter(true)
      }
    } catch {
      setError('Failed to generate letter. Please try again.')
    } finally {
      setLetterLoading(false)
    }
  }

  const copyText = async (text: string, type: 'rights' | 'letter') => {
    await navigator.clipboard.writeText(text)
    if (type === 'rights') { setCopiedRights(true); setTimeout(() => setCopiedRights(false), 2000) }
    else { setCopiedLetter(true); setTimeout(() => setCopiedLetter(false), 2000) }
  }

  const shareWhatsApp = (text: string) => {
    const msg = `*KnowYourRights GH*\n\n${text}\n\n_via LawBridge GH — lawbridge.gh_`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const rateSatisfaction = async (satisfied: boolean) => {
    if (!result || satisfaction !== null) return
    setSatisfaction(satisfied)
    await fetch('/api/query', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_id: result.query_id, satisfied }),
    })
  }

  const charCount = inputText.length
  const isOverLimit = charCount > MAX_CHARS

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        {/* Language selector */}
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-semibold text-text-secondary">Response language:</label>
          <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
            {LANGUAGE_OPTIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code as 'en' | 'tw' | 'ga')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedLang === lang.code
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Describe your situation in detail…&#10;&#10;Example: My landlord is refusing to return my GHS 2,000 deposit after I moved out 3 months ago. He claims there was damage but never showed me any evidence."
            className={`w-full min-h-[160px] resize-none rounded-xl border p-4 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 text-base leading-relaxed transition-colors ${
              isOverLimit ? 'border-danger focus:ring-danger/30' : 'border-border'
            }`}
            disabled={isLoading}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
          />
          <div className={`absolute bottom-3 right-3 text-xs ${isOverLimit ? 'text-danger' : 'text-text-muted'}`}>
            {charCount}/{MAX_CHARS}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            {!user && error.includes('limit') && (
              <> <a href="/signup" className="underline font-medium">Sign up free →</a></>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <p className="text-xs text-text-muted hidden sm:block">
            Tip: Press ⌘↵ to submit
          </p>
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || !inputText.trim() || isOverLimit}
            className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
            ) : (
              <><Send className="w-4 h-4" /> Get My Rights</>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-border p-8 text-center animate-fade-in">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <p className="font-medium text-text-primary mb-1">Searching Ghana's laws…</p>
          <p className="text-sm text-text-muted">Finding the relevant Acts and Articles for your situation</p>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div ref={resultRef} className="space-y-4 animate-fade-in">

          {/* Your Rights section */}
          {result.rights_response && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-bold text-text-primary">Your Rights</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(result.rights_response!, 'rights')}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    {copiedRights ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedRights ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(result.rights_response!)}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="prose prose-sm max-w-none text-text-primary leading-relaxed whitespace-pre-wrap">
                  {result.rights_response}
                </div>

                {/* Cited articles */}
                {result.cited_articles?.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Legal Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {result.cited_articles.map(article => (
                        <span key={article} className="text-xs bg-primary/10 text-primary font-medium px-3 py-1 rounded-full">
                          {article}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Letter button / Letter section */}
          {!showLetter && !result.letter_response ? (
            <button
              onClick={handleGenerateLetter}
              disabled={letterLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-dashed border-border rounded-2xl py-5 text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-medium"
            >
              {letterLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Drafting your letter…</>
              ) : (
                <><FileText className="w-5 h-5" /> Generate Formal Letter</>
              )}
            </button>
          ) : (result.letter_response && showLetter) || result.letter_response ? (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-amber-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700" />
                  <h2 className="font-display font-bold text-text-primary">Your Formal Letter</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(result.letter_response!, 'letter')}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    {copiedLetter ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLetter ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(result.letter_response!)}
                    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  {/* PDF export — Pro feature */}
                  {isPro ? (
                    <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/settings/upgrade')}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                      title="Upgrade to Pro to download PDF"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      PDF (Pro)
                    </button>
                  )}
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="font-mono text-sm text-text-primary leading-relaxed whitespace-pre-wrap bg-surface-secondary rounded-xl p-4 border border-border">
                  {result.letter_response}
                </div>
                <p className="text-xs text-text-muted mt-3">
                  📝 Review and fill in the bracketed placeholders [YOUR NAME], [DATE], etc. before sending.
                </p>
              </div>
            </div>
          ) : null}

          {/* Feedback + Lawyer CTA */}
          <div className="bg-white rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Was this helpful?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => rateSatisfaction(true)}
                  disabled={satisfaction !== null}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    satisfaction === true
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'border-border text-text-secondary hover:border-green-300 hover:text-green-700'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" /> Yes
                </button>
                <button
                  onClick={() => rateSatisfaction(false)}
                  disabled={satisfaction !== null}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    satisfaction === false
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'border-border text-text-secondary hover:border-red-300 hover:text-red-700'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" /> No
                </button>
              </div>
            </div>

            <a
              href="/lawyers"
              className="flex items-center gap-2 bg-primary/10 text-primary font-semibold px-5 py-3 rounded-xl hover:bg-primary hover:text-white transition-all text-sm"
            >
              <Users className="w-4 h-4" />
              Speak to a Lawyer
            </a>
          </div>

          {/* Performance info */}
          {result.latency_ms && (
            <p className="text-xs text-text-muted text-center">
              Response generated in {(result.latency_ms / 1000).toFixed(1)}s
              {result.rate_limit && ` • ${result.rate_limit.remaining} queries remaining today`}
            </p>
          )}
        </div>
      )}

      {/* Floating lawyer CTA — visible after result */}
      {result && (
        <div className="fixed bottom-6 right-6 z-40">
          <a
            href="/lawyers"
            className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-3 rounded-full shadow-lg hover:bg-primary-hover transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <Users className="w-4 h-4" />
            Find a Lawyer
          </a>
        </div>
      )}
    </div>
  )
}
