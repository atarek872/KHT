import { createAdminSession } from '../../utils/adminAuth'
import { enforceRateLimit } from '../../utils/rateLimit'
import { requireJsonBody } from '../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'admin-login', 10, 15 * 60)
  const body = await requireJsonBody<{ email?: unknown; password?: unknown }>(event, 4_096)
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required.' })
  }
  if (!(await createAdminSession(event, body.email, body.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect credentials.' })
  }
  return { authenticated: true }
})
