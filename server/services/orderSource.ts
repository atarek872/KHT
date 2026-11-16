import type { OrderSource } from '../../shared/adminOrder.ts'
import type { D1Database } from '../utils/d1.ts'

export async function updateOrderSource(
  database: D1Database,
  id: string,
  source: OrderSource,
  actor: string,
) {
  const current = await database
    .prepare('SELECT source FROM orders WHERE id = ?')
    .bind(id)
    .first<{ source: OrderSource }>()
  if (!current) throw new Error('ORDER_NOT_FOUND')
  if (current.source === source) return { source }
  const eventId = crypto.randomUUID()
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO order_events
      (id, order_id, event_type, from_value, to_value, actor_email)
      SELECT ?, id, 'source_changed', source, ?, ? FROM orders WHERE id = ? AND source = ?`,
      )
      .bind(eventId, source, actor, id, current.source),
    database
      .prepare(
        `UPDATE orders SET source = ? WHERE id = ? AND source = ?
      AND EXISTS (SELECT 1 FROM order_events WHERE id = ?)`,
      )
      .bind(source, id, current.source, eventId),
  ])
  if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1)
    throw new Error('ORDER_SOURCE_CONFLICT')
  return { source }
}
