import type { InventoryFilters } from '../../../../shared/inventory'
import { listInventory } from '../../../services/inventory'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const query = getQuery(event)
  const filters: InventoryFilters = {
    q: typeof query.q === 'string' ? query.q : undefined,
    category: typeof query.category === 'string' ? query.category : undefined,
    lowStock: query.lowStock === 'true',
  }
  return { items: await listInventory(database, filters) }
})