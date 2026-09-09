import {
  accountBody,
  requireCustomer,
  rateLimit,
  invalidAccount,
} from '../../../utils/customerAuth'
import { field } from '../../../services/customerAccounts'
export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  const { user, database } = await requireCustomer(event)
  await rateLimit(event, 'write', user.id)
  const id = getRouterParam(event, 'id') || ''
  const owned = await database
    .prepare('SELECT id FROM customer_addresses WHERE id=? AND user_id=?')
    .bind(id, user.id)
    .first()
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'Address not found.' })
  let address
  try {
    address = {
      id,
      label: field(body.label, 'label', 50),
      name: field(body.name, 'name', 100),
      phone: field(body.phone, 'phone', 30),
      address: field(body.address, 'address', 500),
      city: field(body.city, 'city', 100),
      governorate: field(body.governorate, 'governorate', 100),
      isDefault: body.isDefault === true,
    }
  } catch (error) {
    invalidAccount(error)
  }
  await database.batch([
    ...(address.isDefault
      ? [
          database
            .prepare('UPDATE customer_addresses SET is_default=0 WHERE user_id=?')
            .bind(user.id),
        ]
      : []),
    database
      .prepare(
        'UPDATE customer_addresses SET label=?,name=?,phone=?,address=?,city=?,governorate=?,is_default=? WHERE id=? AND user_id=?',
      )
      .bind(
        address.label,
        address.name,
        address.phone,
        address.address,
        address.city,
        address.governorate,
        address.isDefault ? 1 : 0,
        id,
        user.id,
      ),
  ])
  return { address }
})
