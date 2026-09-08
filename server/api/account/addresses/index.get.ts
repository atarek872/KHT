import { requireCustomer } from '../../../utils/customerAuth'
import type { CustomerAddress } from '../../../../shared/account'
export default defineEventHandler(async (event) => {
  const { user, database } = await requireCustomer(event)
  const result = await database
    .prepare(
      'SELECT id,label,name,phone,address,city,governorate,is_default FROM customer_addresses WHERE user_id=? ORDER BY is_default DESC,rowid DESC',
    )
    .bind(user.id)
    .all<Omit<CustomerAddress, 'isDefault'> & { is_default: number }>()
  return {
    items: (result.results || []).map(({ is_default, ...address }) => ({
      ...address,
      isDefault: Boolean(is_default),
    })),
  }
})
