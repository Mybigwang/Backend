import { reconcileUser } from '@/server/services/reconcileService'
import { reconcileQuerySchema } from '@/server/validation/schemas'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk } from '@/server/utils/responses'

export async function GET(request: Request) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'admin:reconcile')
    const url = new URL(request.url)
    const query = reconcileQuerySchema.parse({
      userId: url.searchParams.get('userId')
    })
    const result = await reconcileUser(query.userId)

    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
