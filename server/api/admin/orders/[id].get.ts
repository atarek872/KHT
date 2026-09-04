import { getAdminOrder } from '../../../services/adminOrders'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
	const { database } = await requireAdmin(event)
	return getAdminOrder(getRouterParam(event, 'id') || '', database)
})