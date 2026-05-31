import { cancelBet } from '@/server/services/betService'
import { routeIdSchema } from '@/server/validation/schemas'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk } from '@/server/utils/responses'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'bets:cancel')
    const { id } = routeIdSchema.parse(await params)
    const result = await cancelBet(id)

    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
