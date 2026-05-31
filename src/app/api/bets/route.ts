import { placeBet } from '@/server/services/betService'
import { placeBetSchema } from '@/server/validation/schemas'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk, requireIdempotencyKey } from '@/server/utils/responses'

export async function POST(request: Request) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'bets:create')
    const idempotencyKey = requireIdempotencyKey(request)
    const body = placeBetSchema.parse(await request.json())
    const result = await placeBet({
      ...body,
      idempotencyKey
    })

    return jsonOk(result, 201)
  } catch (error) {
    return jsonError(error)
  }
}
