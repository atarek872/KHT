import { destroyAdminSession } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await destroyAdminSession(event)
  return { authenticated: false }
})