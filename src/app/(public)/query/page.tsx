import { Suspense } from 'react'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Navbar } from '@/components/layout/navbar'
import { QueryInterface } from '@/components/query/query-interface'
import { Scale } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ask a Legal Question',
  description: 'Get free AI-powered legal guidance based on Ghana\'s Constitution and laws.',
}

export default async function QueryPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const user = await getServerUser()
  let profile = null

  if (user) {
    const [p] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
    profile = p ?? null
  }

  const initialQuery = searchParams.q ? decodeURIComponent(searchParams.q) : undefined

  return (
    <div className="flex flex-col min-h-screen bg-surface-secondary">
      <Navbar user={user} profile={profile} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-2 rounded-full mb-4">
            <Scale className="w-4 h-4" />
            Based on Ghana's Constitution & Laws
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
            What's your legal situation?
          </h1>
          <p className="text-text-secondary max-w-md mx-auto">
            Describe what happened in plain language. We'll explain your rights and help you respond — in English, Twi, or Ga.
          </p>
        </div>

        {/* Rate limit info for anonymous users */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-amber-500 text-lg">ℹ️</span>
            <div className="text-sm text-amber-900">
              <strong>3 free questions per day</strong> without an account.{' '}
              <a href="/signup" className="underline font-medium hover:text-amber-700">
                Sign up free
              </a>{' '}
              for 10 questions per day and to save your case history.
            </div>
          </div>
        )}

        <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
          <QueryInterface
            user={user}
            profile={profile}
            initialQuery={initialQuery}
          />
        </Suspense>

        {/* Disclaimer */}
        <div className="mt-8 disclaimer-banner">
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong>⚖️ Legal Information Only:</strong> Responses are based on Ghanaian law but are not legal advice. Always consult a qualified lawyer for your specific situation.
          </p>
        </div>
      </main>
    </div>
  )
}
