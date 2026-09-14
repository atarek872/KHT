import type { StorefrontContent } from '../../../../shared/storeContent'
import { publishStoreContent } from '../../../services/storeContent'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { database, email } = await requireAdmin(event)
  try {
    return await publishStoreContent(
      database,
      await requireJsonBody<StorefrontContent>(event, 131_072),
      email,
    )
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Changes could not be published.',
    })
  }
})
