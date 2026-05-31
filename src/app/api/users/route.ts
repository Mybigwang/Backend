import { createUserSchema } from '@/server/validation/schemas'
import { createUser } from '@/server/services/userService'
import { requireApiKey } from '@/server/utils/auth'
import { requireRateLimit } from '@/server/utils/rateLimit'
import { jsonError, jsonOk } from '@/server/utils/responses'

export async function POST(request: Request) {
  try {
    requireApiKey(request)
    requireRateLimit(request, 'users:create')
    const body = createUserSchema.parse(await request.json())
    const user = await createUser(body.username)

    return jsonOk(user, 201)
  } catch (error) {
    return jsonError(error)
  }
}
