import Link from 'next/link'
import { Scale } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-text-primary text-white mt-auto">
      <div className="ghana-stripe h-1" />
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg">
                LawBridge <span className="text-accent">GH</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Making Ghana's legal rights accessible to every citizen — in English, Twi, and Ga. Free, fast, and built for mobile.
            </p>
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Disclaimer:</strong> LawBridge GH provides legal information, not legal advice. For your specific situation, consult a qualified Ghanaian lawyer.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4 text-gray-300 uppercase tracking-wide">Platform</h3>
            <ul className="space-y-2">
              {[
                { href: '/query', label: 'Ask a Question' },
                { href: '/lawyers', label: 'Find a Lawyer' },
                { href: '/how-it-works', label: 'How It Works' },
                { href: '/about', label: 'About Us' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-accent transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4 text-gray-300 uppercase tracking-wide">Legal</h3>
            <ul className="space-y-2">
              {[
                { href: '/terms', label: 'Terms of Service' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/disclaimer', label: 'Legal Disclaimer' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-accent transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} LawBridge GH. Built for Ghanaians, by Ghanaians.
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Supporting</span>
            <span className="text-brand-red font-medium">SDG 1</span>
            <span>•</span>
            <span className="text-brand-gold font-medium">SDG 10</span>
            <span>•</span>
            <span className="text-brand-green font-medium">SDG 16</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
