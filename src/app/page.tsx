import Link from 'next/link'
import Image from 'next/image'
import { Scale, ChevronRight, Shield, BookOpen, Users, Star, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getServerUser } from '@/lib/supabase/server'

const SCENARIOS = [
  {
    icon: '🏠',
    title: 'Landlord won\'t return deposit',
    description: 'My landlord is refusing to give back my GHS 2,000 deposit after I moved out. It\'s been 3 months.',
    tag: 'Rent Act 220',
  },
  {
    icon: '💼',
    title: 'Employer withheld salary',
    description: 'My boss hasn\'t paid me for two months and says the company has "cash flow issues."',
    tag: 'Labour Act 651',
  },
  {
    icon: '⚖️',
    title: 'Arrested without reason',
    description: 'Police detained me for 48 hours without charging me or telling me why I was arrested.',
    tag: 'Constitution Art. 14',
  },
  {
    icon: '👶',
    title: 'Child custody rights',
    description: 'My ex-partner is stopping me from seeing my children and I don\'t know what my rights are.',
    tag: 'Children\'s Act 560',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Describe your situation',
    description: 'Tell us what happened in plain language — in English, Twi, or Ga. No legal knowledge needed.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'Get your rights explained',
    description: 'Our AI finds the exact laws that protect you and explains them in simple, clear language.',
    icon: Shield,
  },
  {
    number: '03',
    title: 'Take action',
    description: 'Download a ready-to-send formal letter, or connect with a verified Ghanaian lawyer.',
    icon: Users,
  },
]

const STATS = [
  { value: '7+', label: 'Laws & Acts covered' },
  { value: '3', label: 'Languages supported' },
  { value: 'Free', label: 'Basic access always' },
  { value: '< 15s', label: 'Average response time' },
]

export default async function HomePage() {
  const user = await getServerUser()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar user={user} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=1600&q=85"
            alt="Ghana Supreme Court"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          <div className="hero-overlay absolute inset-0" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse-soft" />
              <span className="text-white text-sm font-medium">Free legal guidance for every Ghanaian</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6 text-balance">
              Know Your Rights.{' '}
              <span className="text-accent">Protect Yourself.</span>
            </h1>

            <p className="text-lg text-white/85 leading-relaxed mb-8 max-w-xl">
              Ghana's laws protect you as a worker, tenant, and citizen. Get plain-language guidance based on the 1992 Constitution and key Acts — in English, Twi, or Ga — in seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/query"
                className="inline-flex items-center justify-center gap-2 bg-accent text-text-primary font-bold px-8 py-4 rounded-xl hover:bg-accent-hover transition-all hover:scale-[1.02] active:scale-[0.98] text-base shadow-lg"
              >
                Ask a Free Question
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/25 transition-all text-base"
              >
                How It Works
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 mt-8">
              {['No signup required', 'Based on Ghana\'s Constitution', 'Available in Twi & Ga'].map(item => (
                <div key={item} className="flex items-center gap-1.5 text-white/80 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="bg-primary py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(stat => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-accent">{stat.value}</p>
                <p className="text-white/80 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Simple as 1 — 2 — 3
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              No legal jargon. No expensive consultations. Just clear answers in the language you speak.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-px bg-border -translate-x-8 z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <span className="font-display text-5xl font-bold text-border block mb-2 leading-none">{step.number}</span>
                  <h3 className="font-display text-xl font-bold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/query"
              className="inline-flex items-center gap-2 bg-primary text-white font-bold px-8 py-4 rounded-xl hover:bg-primary-hover transition-colors"
            >
              Try It Now — It's Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sample scenarios ──────────────────────────────────────────────── */}
      <section className="py-20 bg-surface-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Common Situations We Help With
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Real scenarios faced by everyday Ghanaians — and the laws that protect them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {SCENARIOS.map(scenario => (
              <Link
                key={scenario.title}
                href={`/query?q=${encodeURIComponent(scenario.description)}`}
                className="group bg-white rounded-2xl p-6 border border-border card-hover cursor-pointer"
              >
                <div className="text-4xl mb-4">{scenario.icon}</div>
                <h3 className="font-display font-bold text-text-primary mb-2 text-lg leading-snug">
                  {scenario.title}
                </h3>
                <p className="text-text-secondary text-sm mb-4 leading-relaxed">
                  {scenario.description}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {scenario.tag}
                </span>
                <div className="flex items-center gap-1 text-primary text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  Ask this question <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lawyer marketplace teaser ─────────────────────────────────────── */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden h-80">
              <Image
                src="https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=800&q=85"
                alt="Ghanaian lawyer in office"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
            </div>
            <div>
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">Need More Help?</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mt-2 mb-4">
                Connect with a Verified Ghanaian Lawyer
              </h2>
              <p className="text-text-secondary leading-relaxed mb-6">
                Our AI gives you a strong foundation. For complex situations, book a one-on-one consultation with a verified lawyer from the Ghana Bar Association — starting from just GHS 50.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'All lawyers verified with Ghana Bar Association',
                  'Video consultations in your preferred language',
                  'Pay with MoMo, card, or cash',
                  'Fixed, transparent fees — no surprises',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/lawyers"
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors"
              >
                Browse Lawyers <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <section className="py-8 bg-amber-50 border-y border-amber-200">
        <div className="container mx-auto px-4">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <Scale className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 leading-relaxed">
              <strong>Legal Information Disclaimer:</strong> LawBridge GH provides general legal information based on Ghanaian law. This is not legal advice and does not create a lawyer-client relationship. For your specific situation, please consult a qualified Ghanaian lawyer.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
