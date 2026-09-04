import { requireAdmin } from '../../../utils/adminAuth'
import { listCustomers, searchCustomers } from '../../../services/adminCustomers'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const query = String(getQuery(event).q || '').trim()
  const mode = getQuery(event).mode
  return { items: mode === 'lookup' ? await searchCustomers(database, query) : await listCustomers(database, query) }
})