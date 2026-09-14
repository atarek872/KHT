import type { StoreCurtainInput } from '../../../shared/storeCurtain'
import { saveStoreCurtain } from '../../services/storeCurtain'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  try {
    return await saveStoreCurtain(database, await readBody<StoreCurtainInput>(event), email)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Store Curtain settings could not be saved.',
    })
  }
})
