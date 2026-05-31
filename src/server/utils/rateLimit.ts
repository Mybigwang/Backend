import { AppError } from '@/server/domain/errors'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 120

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function requireRateLimit(request: Request, scope: string) {
  const now = Date.now()
  const key = `${scope}:${clientKey(request)}`
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS
    })
    return
  }

  if (bucket.count >= MAX_REQUESTS) {
    throw new AppError('RATE_LIMITED', 'Too many requests', 429)
  }

  buckets.set(key, {
    ...bucket,
    count: bucket.count + 1
  })
}

function clientKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const apiKey = request.headers.get('x-api-key') ?? 'anonymous'

  return `${forwardedFor ?? 'unknown'}:${apiKey}`
}
