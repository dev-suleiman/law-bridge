/**
 * GhanaNLP Khaya AI Translation Service
 * Docs: https://translation.ghananlp.org
 */

const KHAYA_BASE = process.env.KHAYA_AI_BASE_URL || 'https://translation-api.ghananlp.org'
const KHAYA_KEY = process.env.KHAYA_AI_API_KEY!

type LangCode = 'en' | 'tw' | 'ga'

// Khaya AI language pair format
const LANG_PAIR_MAP: Record<string, string> = {
  'tw-en': 'ak-en',  // Twi (Akan) → English
  'en-tw': 'en-ak',  // English → Twi
  'ga-en': 'gaa-en', // Ga → English
  'en-ga': 'en-gaa', // English → Ga
}

interface KhayaResponse {
  translatedText: string
}

/**
 * Translate text between supported languages.
 * If source and target are the same, returns text unchanged.
 */
export async function translateText(
  text: string,
  from: LangCode,
  to: LangCode
): Promise<string> {
  if (from === to) return text
  if (!text.trim()) return text

  const pairKey = `${from}-${to}`
  const khayaPair = LANG_PAIR_MAP[pairKey]

  if (!khayaPair) {
    console.warn(`[Translation] Unsupported pair: ${pairKey}, returning original`)
    return text
  }

  try {
    const response = await fetch(`${KHAYA_BASE}/v1/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': KHAYA_KEY,
      },
      body: JSON.stringify({
        in: text,
        lang: khayaPair,
      }),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Khaya AI error ${response.status}: ${errText}`)
    }

    const data = (await response.json()) as KhayaResponse
    return data.translatedText || text
  } catch (err) {
    console.error('[Translation] Khaya AI request failed:', err)
    // Graceful fallback: return original text
    return text
  }
}

/**
 * Detect language from text using franc-min (client-side / lightweight).
 * Returns 'en' as fallback for unsupported languages.
 */
export async function detectLanguage(text: string): Promise<LangCode> {
  try {
    // Dynamic import to avoid SSR issues with franc-min
    const { franc } = await import('franc-min')
    const detected = franc(text, { minLength: 3 })

    // Map ISO 639-3 codes to our language codes
    const langMap: Record<string, LangCode> = {
      eng: 'en',
      aka: 'tw', // Akan/Twi
      gaa: 'ga',
    }

    return langMap[detected] ?? 'en'
  } catch {
    return 'en'
  }
}
