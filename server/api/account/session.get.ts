import { getCustomer } from '../../utils/customerAuth'
export default defineEventHandler(async (event) => ({ user: await getCustomer(event) }))
