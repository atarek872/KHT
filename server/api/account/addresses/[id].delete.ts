import { requireCustomerOrigin, requireCustomer, rateLimit } from '../../../utils/customerAuth'
export default defineEventHandler(async (event) => {
  requireCustomerOrigin(event)
  const { user, database } = await requireCustomer(event)
  await rateLimit(event, 'write', user.id)
  const result = await database
    .prepare('DELETE FROM customer_addresses WHERE id=? AND user_id=?')
    .bind(getRouterParam(event, 'id') || '', user.id)
    .run()
  if (!result.meta?.changes)
    throw createError({ statusCode: 404, statusMessage: 'Address not found.' })
  return { ok: true }
})
