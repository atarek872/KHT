import { getPublicWelcomeCampaign } from '../../services/welcomeCampaign'
import { requireDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return { campaign: await getPublicWelcomeCampaign(requireDatabase(event)) }
})
