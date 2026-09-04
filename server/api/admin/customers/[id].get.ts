import { getCustomer } from '../../../services/adminCustomers'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const customer = await getCustomer(database, getRouterParam(event, 'id') || '')
  if (!customer) throw createError({ statusCode: 404, statusMessage: 'Customer not found.' })
  return customer
})