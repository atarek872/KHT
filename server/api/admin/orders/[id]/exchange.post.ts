import { exchangeOrderComponent } from '../../../../services/orderExchanges.ts'
import type { ExchangeInput } from '../../../../services/orderExchanges.ts'
import { requireAdmin } from '../../../../utils/adminAuth.ts'
import { requireJsonBody } from '../../../../utils/requestGuards.ts'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await requireJsonBody<ExchangeInput>(event, 4_096)
  try {
    return await exchangeOrderComponent(database, id, body, email)
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : ''
    const statusCode = code === 'EXCHANGE_INVALID_INPUT' ? 400 : 409
    const statusMessage =
      code === 'EXCHANGE_INVALID_INPUT'
        ? 'Choose a valid piece, size, and quantity.'
        : code === 'EXCHANGE_RETURN_NOT_RECEIVED'
          ? 'Confirm the returned piece has been received before changing stock.'
          : code === 'EXCHANGE_TARGET_UNAVAILABLE'
            ? 'The replacement size is unavailable. Refresh the order and try again.'
            : 'The order or its stock changed. Refresh and try again.'
    throw createError({ statusCode, statusMessage })
  }
})
