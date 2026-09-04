import { buildPersistedDashboardSnapshot, parseDashboardRange } from '../../services/dashboard'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database } = await requireAdmin(event)
  const range = parseDashboardRange(getQuery(event).range)
  return buildPersistedDashboardSnapshot(database, range)
})