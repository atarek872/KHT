import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  CustomerSearchResult,
} from '../../shared/adminCustomer'
import type { AdminOrderSummary } from '../../shared/adminOrder'
import type { D1Database } from '../utils/d1'

type CustomerSummaryRow = Omit<AdminCustomerSummary, 'ordersCount' | 'totalSpent'> & {
  ordersCount: number | string
  totalSpent: number | string
}

const mapSummary = (row: CustomerSummaryRow): AdminCustomerSummary => ({
  ...row,
  email: row.email || undefined,
  lastOrderAt: row.lastOrderAt || undefined,
  ordersCount: Number(row.ordersCount),
  totalSpent: Number(row.totalSpent),
})

export async function listCustomers(database: D1Database, query = '') {
  const search = query.trim()
  const values: unknown[] = []
  let where = ''
  let order = 'ORDER BY lastOrderAt DESC, c.created_at DESC'
  if (search) {
    const like = `%${search}%`
    const prefix = `${search}%`
    where = 'WHERE c.phone LIKE ? OR c.name LIKE ? OR COALESCE(c.email, \'\') LIKE ?'
    values.push(like, like, like, prefix, prefix, prefix)
    order = `ORDER BY CASE
      WHEN c.phone LIKE ? THEN 0
      WHEN c.name LIKE ? THEN 1
      WHEN COALESCE(c.email, '') LIKE ? THEN 2
      ELSE 3 END, lastOrderAt DESC`
  }
  const result = await database.prepare(`SELECT c.id, c.name, c.phone, c.email,
    COUNT(o.id) AS ordersCount,
    COALESCE(SUM(CASE WHEN o.payment_status = 'paid' OR o.fulfillment_status = 'delivered'
      THEN o.total ELSE 0 END), 0) AS totalSpent,
    MAX(o.created_at) AS lastOrderAt
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    ${where} GROUP BY c.id ${order} LIMIT 100`).bind(...values).all<CustomerSummaryRow>()
  return (result.results || []).map(mapSummary)
}

export async function searchCustomers(database: D1Database, query: string) {
  const search = query.trim()
  if (search.length < 2) return []
  const like = `%${search}%`
  const prefix = `${search}%`
  const result = await database.prepare(`SELECT id, name, phone, email, address, governorate, city
    FROM customers WHERE phone LIKE ? OR name LIKE ? OR COALESCE(email, '') LIKE ?
    ORDER BY CASE WHEN phone LIKE ? THEN 0 WHEN name LIKE ? THEN 1
      WHEN COALESCE(email, '') LIKE ? THEN 2 ELSE 3 END, created_at DESC LIMIT 10`)
    .bind(like, like, like, prefix, prefix, prefix).all<CustomerSearchResult>()
  return result.results || []
}

export async function getCustomer(database: D1Database, id: string): Promise<AdminCustomerDetail | null> {
  const customer = await database.prepare(`SELECT c.id, c.name, c.phone, c.email,
    c.address, c.governorate, c.city, c.created_at AS createdAt,
    COUNT(o.id) AS ordersCount,
    COALESCE(SUM(CASE WHEN o.payment_status = 'paid' OR o.fulfillment_status = 'delivered'
      THEN o.total ELSE 0 END), 0) AS totalSpent,
    MAX(o.created_at) AS lastOrderAt
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.id = ? GROUP BY c.id`).bind(id).first<CustomerSummaryRow & {
      address: string
      governorate: string
      city: string
      createdAt: string
    }>()
  if (!customer) return null
  const orders = await database.prepare(`SELECT o.id, o.number, c.name AS customerName,
    c.phone AS customerPhone, o.total, o.payment_method AS paymentMethod,
    o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
    o.source, o.created_at AS createdAt FROM orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 100`).bind(id).all<AdminOrderSummary>()
  return { ...mapSummary(customer), address: customer.address, governorate: customer.governorate,
    city: customer.city, createdAt: customer.createdAt, orders: orders.results || [] }
}