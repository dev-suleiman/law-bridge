import Image from 'next/image'
import { getServerUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, lawyers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { LawyerSearch } from '@/components/lawyers/lawyer-search'
import { Star, MapPin, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find a Lawyer',
  description: 'Connect with verified Ghanaian lawyers for paid consultations.',
}

export default async function LawyersPage() {
  const user = await getServerUser()
  let profile = null
  if (user) {
    const [p] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
    profile = p ?? null
  }

  // Fetch initial lawyers
  const initialLawyers = await db
    .select()
    .from(lawyers)
    .where(and(eq(lawyers.isVerified, true), eq(lawyers.isActive, true)))
    .limit(12)

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar user={user} profile={profile} />

      {/* Hero */}
      <section className="relative h-52 flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1593115057322-e94b77572f20?w=1200&q=80"
            alt="Legal books and scales of justice"
            fill
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-primary/75" />
        </div>
        <div className="relative container mx-auto px-4">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Find a Verified Lawyer
          </h1>
          <p className="text-white/85">
            All lawyers verified by the Ghana Bar Association · Pay with MoMo or card
          </p>
        </div>
      </section>

      <main className="flex-1 bg-surface-secondary py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <LawyerSearch initialLawyers={initialLawyers} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
