import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'
import { createHash } from 'crypto'

let redis: Redis | null = null
let rateLimiters: Record<string, Ratelimit> | null = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

function getRateLimiters() {
  if (!rateLimiters) {
    const r = getRedis()
    rateLimiters = {
      anonymous: new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(3, '24 h'),
        prefix: 'rl:anon',
      }),
      free: new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(10, '24 h'),
        prefix: 'rl:free',
      }),
      pro: new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(1000, '24 h'),
        prefix: 'rl:pro',
      }),
    }
  }
  return rateLimiters
}

export type UserTier = 'anonymous' | 'free' | 'pro' | 'lawyer' | 'admin'

export async function checkRateLimit(
  userId: string | null,
  tier: UserTier
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  // Admins and lawyers are unlimited
  if (tier === 'admin' || tier === 'lawyer') {
    return { success: true, limit: 9999, remaining: 9999, reset: new Date() }
  }

  const limiters = getRateLimiters()
  const limiterKey = tier === 'pro' ? 'pro' : tier === 'free' ? 'free' : 'anonymous'
  const limiter = limiters[limiterKey]

  // Build identifier: user ID or hashed IP
  let identifier: string
  if (userId) {
    identifier = userId
  } else {
    const headersList = headers()
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'unknown'
    identifier = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: new Date(result.reset),
  }
}

/** Get hashed IP for anonymous query tracking */
export function getHashedIp(): string {
  const headersList = headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0] ||
    headersList.get('x-real-ip') ||
    'unknown'
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}
