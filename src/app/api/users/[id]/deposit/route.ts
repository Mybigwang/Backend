import { deposit } from '@/server/services/userService'
import { depositSchema, routeIdSchema } from '@/server/validation/schemas'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk, requireIdempotencyKey } from '@/server/utils/responses'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'users:deposit')
    const { id } = routeIdSchema.parse(await params)
    const idempotencyKey = requireIdempotencyKey(request)
    const body = depositSchema.parse(await request.json())
    const result = await deposit(id, body.amount, idempotencyKey)

    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
