import { requireCustomer } from '../../../utils/customerAuth'
import { listCustomerOrders } from '../../../services/customerOrders'
export default defineEventHandler(async (event) => {
  const { user, database } = await requireCustomer(event)
  return listCustomerOrders(database, user.id, Number(getQuery(event).page || 1))
})
