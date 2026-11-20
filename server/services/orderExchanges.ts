import type { D1Database } from '../utils/d1.ts'

export interface ExchangeInput {
  requestId: string
  orderItemId: string
  fromVariantId: string
  toVariantId: string
  quantity: number
  returnedReceived: boolean
  note?: string
}

type ExchangeContext = {
  status: string
  productName: string
  fromSize: string
  toSize: string
  available: number
  allocated: number
}

export async function exchangeOrderComponent(
  database: D1Database,
  orderId: string,
  input: ExchangeInput,
  actorEmail: string,
) {
  if (
    !orderId.trim() ||
    !actorEmail.trim() ||
    typeof input?.requestId !== 'string' ||
    !/^[a-f0-9-]{20,80}$/i.test(input.requestId) ||
    typeof input.orderItemId !== 'string' ||
    typeof input.fromVariantId !== 'string' ||
    typeof input.toVariantId !== 'string' ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10 ||
    typeof input.returnedReceived !== 'boolean' ||
    (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 500))
  )
    throw new Error('EXCHANGE_INVALID_INPUT')

  const existing = await database
    .prepare(
      `SELECT id,order_id AS orderId,order_item_id AS orderItemId,
    from_variant_id AS fromVariantId,to_variant_id AS toVariantId,quantity,
    returned_received AS returnedReceived FROM order_component_exchanges WHERE request_id=?`,
    )
    .bind(input.requestId)
    .first<{
      id: string
      orderId: string
      orderItemId: string
      fromVariantId: string
      toVariantId: string
      quantity: number
      returnedReceived: number
    }>()
  if (existing) {
    if (
      existing.orderId !== orderId ||
      existing.orderItemId !== input.orderItemId ||
      existing.fromVariantId !== input.fromVariantId ||
      existing.toVariantId !== input.toVariantId ||
      existing.quantity !== input.quantity ||
      Boolean(existing.returnedReceived) !== input.returnedReceived
    )
      throw new Error('EXCHANGE_CONFLICT')
    return { exchanged: true as const, id: existing.id }
  }

  const context = await database
    .prepare(
      `SELECT o.fulfillment_status AS status,
    source.product_name AS productName, source.size AS fromSize,
    target.size AS toSize, target.stock AS available, c.quantity AS allocated
    FROM orders o JOIN order_items oi ON oi.order_id=o.id
    JOIN order_item_components c ON c.order_item_id=oi.id
    JOIN inventory_variants source ON source.id=c.variant_id
    JOIN inventory_variants target ON target.id=?
    WHERE o.id=? AND oi.id=? AND source.id=?`,
    )
    .bind(input.toVariantId, orderId, input.orderItemId, input.fromVariantId)
    .first<ExchangeContext>()
  if (!context) throw new Error('EXCHANGE_SOURCE_UNAVAILABLE')
  if (context.allocated < input.quantity) throw new Error('EXCHANGE_SOURCE_UNAVAILABLE')
  if (context.available < input.quantity) throw new Error('EXCHANGE_TARGET_UNAVAILABLE')
  if (
    ['shipped', 'out-for-delivery', 'delivered'].includes(context.status) &&
    !input.returnedReceived
  )
    throw new Error('EXCHANGE_RETURN_NOT_RECEIVED')
  const label = `${context.productName}: ${context.fromSize} → ${context.toSize} × ${input.quantity}`
  const note = [
    label,
    input.returnedReceived ? 'Returned piece received.' : '',
    input.note?.trim() || '',
  ]
    .filter(Boolean)
    .join(' ')
  const id = crypto.randomUUID()
  try {
    await database
      .prepare(
        `INSERT INTO order_component_exchanges
      (id,request_id,order_id,order_item_id,from_variant_id,to_variant_id,quantity,
       returned_received,actor_email,note,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        input.requestId,
        orderId,
        input.orderItemId,
        input.fromVariantId,
        input.toVariantId,
        input.quantity,
        input.returnedReceived ? 1 : 0,
        actorEmail.trim(),
        note,
        new Date().toISOString(),
      )
      .run()
  } catch (cause) {
    const retry = await database
      .prepare(
        `SELECT id,order_id AS orderId,order_item_id AS orderItemId,
      from_variant_id AS fromVariantId,to_variant_id AS toVariantId,quantity,
      returned_received AS returnedReceived FROM order_component_exchanges WHERE request_id=?`,
      )
      .bind(input.requestId)
      .first<{
        id: string
        orderId: string
        orderItemId: string
        fromVariantId: string
        toVariantId: string
        quantity: number
        returnedReceived: number
      }>()
    if (
      retry?.orderId === orderId &&
      retry.orderItemId === input.orderItemId &&
      retry.fromVariantId === input.fromVariantId &&
      retry.toVariantId === input.toVariantId &&
      retry.quantity === input.quantity &&
      Boolean(retry.returnedReceived) === input.returnedReceived
    )
      return { exchanged: true as const, id: retry.id }
    throw cause
  }
  return { exchanged: true as const, id }
}
