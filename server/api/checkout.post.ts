import { catalog } from '../data/catalog'
import { priceOrder } from '../../shared/order'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (body?.demoAcknowledged !== true)
    throw createError({
      statusCode: 400,
      statusMessage: 'This checkout is a demonstration. Acknowledge demo mode to continue.',
    })
  // No customer details or payment information are collected by this endpoint.
  // It validates a demo quote; it does not create or fulfill a commercial order.
  try {
    return {
      ...priceOrder(body.items, catalog),
      reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      demo: true as const,
    }
  } catch (error) {
    throw createError({
      statusCode: 409,
      statusMessage: error instanceof Error ? error.message : 'Review your bag and try again.',
    })
  }
})
