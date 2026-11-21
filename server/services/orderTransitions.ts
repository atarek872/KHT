import type { OrderFulfillmentStatus, OrderPaymentStatus } from '../../shared/adminOrder.ts'
import type { D1Database } from '../utils/d1.ts'
import {
  enqueueMetaStatement,
  orderLifecycleMetaEvent,
  type MetaCommerceEvent,
} from './metaCapi.ts'

const transitions: Record<OrderFulfillmentStatus, OrderFulfillmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out-for-delivery'],
  'out-for-delivery': ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

const fulfillmentStatuses = new Set<OrderFulfillmentStatus>(
  Object.keys(transitions) as OrderFulfillmentStatus[],
)

interface CurrentOrderStatus {
  fulfillmentStatus: OrderFulfillmentStatus
  paymentStatus: OrderPaymentStatus
}

interface CurrentOrderRecord extends CurrentOrderStatus {
  publicReference: string
  purchaseMetaPayloadJson: string | null
}

export interface OrderTransitionResult extends CurrentOrderStatus {
  inventoryRestoredAt?: string
  returnedRestockedAt?: string
  analyticsEvent?: {
    eventName: Extract<MetaCommerceEvent, 'OrderConfirmed' | 'OrderDelivered'>
    eventId: string
  }
}

export function isOrderFulfillmentStatus(value: unknown): value is OrderFulfillmentStatus {
  return typeof value === 'string' && fulfillmentStatuses.has(value as OrderFulfillmentStatus)
}

export function allowedFulfillmentTransitions(status: OrderFulfillmentStatus) {
  return [...transitions[status]]
}

function validateMutationInput(id: string, actorEmail: string, note?: string) {
  if (!id.trim() || !actorEmail.trim()) throw new Error('ORDER_INVALID_INPUT')
  const cleanNote = note?.trim() || undefined
  if (cleanNote && cleanNote.length > 500) throw new Error('ORDER_INVALID_INPUT')
  return cleanNote
}

async function currentOrder(database: D1Database, id: string) {
  return database
    .prepare(
      `SELECT fulfillment_status AS fulfillmentStatus, payment_status AS paymentStatus,
         public_reference AS publicReference,
         (SELECT payload_json FROM meta_event_outbox
          WHERE event_name='Purchase' AND event_id=orders.public_reference) AS purchaseMetaPayloadJson
       FROM orders WHERE id = ?`,
    )
    .bind(id)
    .first<CurrentOrderRecord>()
}

function restoreInventoryStatement(database: D1Database, orderId: string, eventId: string) {
  return database
    .prepare(
      `UPDATE inventory_variants
       SET stock = stock + COALESCE((
         SELECT SUM(c.quantity) FROM order_item_components c
         JOIN order_items oi ON oi.id=c.order_item_id
         WHERE oi.order_id=? AND c.variant_id=inventory_variants.id
       ),0) + COALESCE((
         SELECT SUM(oi.quantity) FROM order_items oi
         WHERE oi.order_id=? AND oi.variant_id=inventory_variants.id
           AND NOT EXISTS(SELECT 1 FROM order_item_components c WHERE c.order_item_id=oi.id)
       ),0)
       WHERE EXISTS (SELECT 1 FROM order_events WHERE id = ?)
         AND (EXISTS (SELECT 1 FROM order_item_components c JOIN order_items oi ON oi.id=c.order_item_id
           WHERE oi.order_id=? AND c.variant_id=inventory_variants.id)
          OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=?
            AND oi.variant_id=inventory_variants.id AND NOT EXISTS(
              SELECT 1 FROM order_item_components c WHERE c.order_item_id=oi.id)))`,
    )
    .bind(orderId, orderId, eventId, orderId, orderId)
}

export async function transitionOrder(
  database: D1Database,
  id: string,
  nextStatus: OrderFulfillmentStatus,
  actorEmail: string,
  note?: string,
): Promise<OrderTransitionResult> {
  const cleanNote = validateMutationInput(id, actorEmail, note)
  if (!isOrderFulfillmentStatus(nextStatus)) throw new Error('ORDER_INVALID_INPUT')
  const current = await currentOrder(database, id)
  if (!current) throw new Error('ORDER_NOT_FOUND')
  if (!transitions[current.fulfillmentStatus].includes(nextStatus)) {
    throw new Error('ORDER_TRANSITION_CONFLICT')
  }

  const eventId = crypto.randomUUID()
  const changedAt = new Date().toISOString()
  const cancelling = nextStatus === 'cancelled'
  const delivered = nextStatus === 'delivered'
  const lifecycleEventName =
    nextStatus === 'confirmed'
      ? 'OrderConfirmed'
      : nextStatus === 'delivered'
        ? 'OrderDelivered'
        : undefined
  const lifecycleEventId = lifecycleEventName
    ? `${current.publicReference}:${nextStatus}`
    : undefined
  const lifecycleEvent =
    lifecycleEventName && lifecycleEventId
      ? orderLifecycleMetaEvent({
          purchasePayloadJson: current.purchaseMetaPayloadJson,
          eventName: lifecycleEventName,
          eventId: lifecycleEventId,
          changedAt,
        })
      : undefined
  const statements = [
    database
      .prepare(
        `INSERT INTO order_events
          (id, order_id, event_type, from_value, to_value, note, actor_email, created_at)
         SELECT ?, id, 'fulfillment_status', fulfillment_status, ?, ?, ?, ?
         FROM orders
         WHERE id = ? AND fulfillment_status = ?
           AND (? = 0 OR inventory_restored_at IS NULL)`,
      )
      .bind(
        eventId,
        nextStatus,
        cleanNote || null,
        actorEmail.trim(),
        changedAt,
        id,
        current.fulfillmentStatus,
        cancelling ? 1 : 0,
      ),
    database
      .prepare(
        `UPDATE orders
         SET fulfillment_status = ?,
           payment_status = CASE
             WHEN ? = 1 THEN 'paid'
             WHEN ? = 1 AND payment_status = 'pending' THEN 'failed'
             ELSE payment_status
           END,
           inventory_restored_at = CASE WHEN ? = 1 THEN ? ELSE inventory_restored_at END
         WHERE id = ? AND fulfillment_status = ?
           AND EXISTS (SELECT 1 FROM order_events WHERE id = ?)`,
      )
      .bind(
        nextStatus,
        delivered ? 1 : 0,
        cancelling ? 1 : 0,
        cancelling ? 1 : 0,
        changedAt,
        id,
        current.fulfillmentStatus,
        eventId,
      ),
    restoreInventoryStatement(database, id, cancelling ? eventId : '__not-a-cancellation__'),
  ]
  if (lifecycleEvent) {
    statements.push(enqueueMetaStatement(database, lifecycleEvent))
    if (nextStatus === 'delivered') {
      statements.push(
        database
          .prepare(
            `UPDATE meta_event_outbox SET payload_json=NULL
             WHERE event_name='Purchase' AND event_id=?`,
          )
          .bind(current.publicReference),
      )
    }
  }
  const results = await database.batch(statements)

  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    throw new Error('ORDER_TRANSITION_CONFLICT')
  }
  return {
    fulfillmentStatus: nextStatus,
    paymentStatus: delivered
      ? 'paid'
      : cancelling && current.paymentStatus === 'pending'
        ? 'failed'
        : current.paymentStatus,
    ...(cancelling ? { inventoryRestoredAt: changedAt } : {}),
    ...(lifecycleEvent
      ? {
          analyticsEvent: {
            eventName: lifecycleEvent.event_name as Extract<
              MetaCommerceEvent,
              'OrderConfirmed' | 'OrderDelivered'
            >,
            eventId: lifecycleEvent.event_id,
          },
        }
      : {}),
  }
}

export async function restockReturnedOrder(
  database: D1Database,
  id: string,
  actorEmail: string,
  note?: string,
): Promise<OrderTransitionResult> {
  const cleanNote = validateMutationInput(id, actorEmail, note)
  const current = await currentOrder(database, id)
  if (!current) throw new Error('ORDER_NOT_FOUND')
  if (current.fulfillmentStatus !== 'returned') throw new Error('ORDER_RESTOCK_CONFLICT')

  const eventId = crypto.randomUUID()
  const changedAt = new Date().toISOString()
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO order_events
          (id, order_id, event_type, note, actor_email, created_at)
         SELECT ?, id, 'inventory_restocked', ?, ?, ? FROM orders
         WHERE id = ? AND fulfillment_status = 'returned' AND returned_restocked_at IS NULL`,
      )
      .bind(eventId, cleanNote || null, actorEmail.trim(), changedAt, id),
    database
      .prepare(
        `UPDATE orders SET returned_restocked_at = ?
         WHERE id = ? AND fulfillment_status = 'returned' AND returned_restocked_at IS NULL
           AND EXISTS (SELECT 1 FROM order_events WHERE id = ?)`,
      )
      .bind(changedAt, id, eventId),
    restoreInventoryStatement(database, id, eventId),
  ])

  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    throw new Error('ORDER_RESTOCK_CONFLICT')
  }
  return {
    fulfillmentStatus: current.fulfillmentStatus,
    paymentStatus: current.paymentStatus,
    returnedRestockedAt: changedAt,
  }
}
