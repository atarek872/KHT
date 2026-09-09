import { getDatabase } from '../../utils/d1'
export default defineEventHandler((event) => ({
  durable: Boolean(getDatabase(event)),
  paymentMethods: ['cod'],
}))
