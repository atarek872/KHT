import { restoreStoreContentVersion } from '../../../services/storeContent'
import { requireAdmin } from '../../../utils/adminAuth'
import { requireJsonBody, requireSameOrigin } from '../../../utils/requestGuards'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { database, email } = await requireAdmin(event)
  const body = await requireJsonBody<{ versionId?: string }>(event)
  if (!body.versionId)
    throw createError({ statusCode: 400, statusMessage: 'Choose a version to restore.' })
  try {
    return await restoreStoreContentVersion(database, body.versionId, email)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Version could not be restored.',
    })
  }
})
