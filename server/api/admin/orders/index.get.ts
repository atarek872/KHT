import { listAdminOrders } from '../../../services/adminOrders'
import { requireAdmin } from '../../../utils/adminAuth'
import { ORDER_FULFILLMENT_STATUSES } from '../../../../shared/adminOrder'
import type { OrderFulfillmentStatus } from '../../../../shared/adminOrder'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : ''
  if (status && !ORDER_FULFILLMENT_STATUSES.includes(status as OrderFulfillmentStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid order status.' })
  }
  const page = typeof query.page === 'string' ? Number(query.page) : 1
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid page number.' })
  }
  return listAdminOrders(database, {
    status: (status as OrderFulfillmentStatus) || undefined,
    q: typeof query.q === 'string' ? query.q : undefined,
    page,
  })
})
