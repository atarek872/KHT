import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  return { authenticated: true, email: session.email }
})