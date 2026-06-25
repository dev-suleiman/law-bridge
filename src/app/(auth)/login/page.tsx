import Link from 'next/link'
import { Scale } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage({ searchParams }: { searchParams: { redirect?: string } }) {
  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">
              LawBridge <span className="text-primary">GH</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-primary">Welcome back</h1>
          <p className="text-text-secondary text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <LoginForm redirectTo={searchParams.redirect} />
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
