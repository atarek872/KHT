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
  let address
  try {
    address = {
      id: crypto.randomUUID(),
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
  const count = await database
    .prepare('SELECT count(*) AS n FROM customer_addresses WHERE user_id=?')
    .bind(user.id)
    .first<{ n: number }>()
  if ((count?.n || 0) >= 20)
    throw createError({ statusCode: 400, statusMessage: 'You can save up to 20 addresses.' })
  address.isDefault = address.isDefault || count?.n === 0
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
        'INSERT INTO customer_addresses(id,user_id,label,name,phone,address,city,governorate,is_default) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        address.id,
        user.id,
        address.label,
        address.name,
        address.phone,
        address.address,
        address.city,
        address.governorate,
        address.isDefault ? 1 : 0,
      ),
  ])
  return { address }
})
