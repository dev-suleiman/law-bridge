import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '@/components/layout/providers'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'LawBridge GH — Know Your Rights',
    template: '%s | LawBridge GH',
  },
  description:
    'Free AI-powered legal rights guidance for Ghanaian citizens. Understand your rights under the 1992 Constitution, Labour Act, Rent Act and more — in English, Twi, and Ga.',
  keywords: ['Ghana legal rights', 'know your rights Ghana', 'legal aid Ghana', 'Ghana constitution', 'tenant rights Ghana', 'worker rights Ghana'],
  authors: [{ name: 'LawBridge GH' }],
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: 'https://lawbridge.gh',
    siteName: 'LawBridge GH',
    title: 'LawBridge GH — Know Your Rights',
    description: 'AI-powered legal rights guidance for every Ghanaian citizen.',
  },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#006B3F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${sourceSans.variable} font-body antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
