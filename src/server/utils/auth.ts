import { AppError } from '@/server/domain/errors'

export function requireApiKey(request: Request) {
  const expectedApiKey = process.env.API_KEY

  if (!expectedApiKey) {
    throw new AppError('API_KEY_NOT_CONFIGURED', 'API key is not configured', 500)
  }

  const apiKey = request.headers.get('X-API-Key')

  if (apiKey !== expectedApiKey) {
    throw new AppError('UNAUTHORIZED', 'Invalid API key', 401)
  }
}
