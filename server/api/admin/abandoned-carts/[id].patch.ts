import type { CartRecoveryState } from '../../../../shared/abandonedCart'
import { updateRecoveryState } from '../../../services/abandonedCarts'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<{ recoveryState?: unknown; note?: unknown }>(event)
  const validStates: CartRecoveryState[] = ['contacted', 'dismissed', 'recovered']
  if (
    !id ||
    !validStates.includes(body?.recoveryState as CartRecoveryState) ||
    (body.note !== undefined && typeof body.note !== 'string')
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid recovery action.' })
  }
  try {
    return await updateRecoveryState(
      database,
      id,
      body.recoveryState as CartRecoveryState,
      email,
      body.note as string | undefined,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CART_RECOVERY_CONFLICT'
    const statusCode =
      message === 'CART_NOT_FOUND' ? 404 : message === 'CART_RECOVERY_INVALID' ? 400 : 409
    throw createError({
      statusCode,
      statusMessage:
        statusCode === 404
          ? 'Cart not found.'
          : statusCode === 400
            ? 'Choose a valid recovery action.'
            : message === 'CART_CONTACT_REQUIRED'
              ? 'Capture a valid phone or email before marking this cart contacted or recovered.'
              : 'The recovery state changed. Refresh and try again.',
    })
  }
})
