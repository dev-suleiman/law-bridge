import Link from 'next/link'
import { Scale } from 'lucide-react'
import { SignupForm } from '@/components/auth/signup-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">
              LawBridge <span className="text-primary">GH</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-text-primary">Create your account</h1>
          <p className="text-text-secondary text-sm mt-1">Free — 10 questions per day</p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <SignupForm />
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>

        <p className="text-center text-xs text-text-muted mt-4 px-4">
          By signing up you agree to our{' '}
          <Link href="/terms" className="underline">Terms</Link> and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
