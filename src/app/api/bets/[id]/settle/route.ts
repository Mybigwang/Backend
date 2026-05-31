import { settleBet } from '@/server/services/betService'
import { routeIdSchema, settleBetSchema } from '@/server/validation/schemas'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk } from '@/server/utils/responses'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'bets:settle')
    const { id } = routeIdSchema.parse(await params)
    const body = settleBetSchema.parse(await request.json())
    const result = await settleBet(id, body.result)

    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
