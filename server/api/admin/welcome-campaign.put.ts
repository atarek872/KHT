import type { WelcomeCampaignInput } from '../../../shared/welcomeCampaign'
import { saveWelcomeCampaign } from '../../services/welcomeCampaign'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { database, email } = await requireAdmin(event)
  try {
    return await saveWelcomeCampaign(database, await readBody<WelcomeCampaignInput>(event), email)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Welcome campaign could not be saved.',
    })
  }
})
