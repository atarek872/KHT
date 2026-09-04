import { createAdminSession } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required.' })
  }
  if (!(await createAdminSession(event, body.email, body.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect credentials.' })
  }
  return { authenticated: true }
})