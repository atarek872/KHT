import type { WelcomeCampaignAdminPayload } from '../../../shared/welcomeCampaign'
import { listDiscounts } from '../../services/discounts'
import { getWelcomeCampaign } from '../../services/welcomeCampaign'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event): Promise<WelcomeCampaignAdminPayload> => {
  const { database } = await requireAdmin(event)
  const [campaign, discounts] = await Promise.all([
    getWelcomeCampaign(database),
    listDiscounts(database),
  ])
  return { campaign, discounts }
})
