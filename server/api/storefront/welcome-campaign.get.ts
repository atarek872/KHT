import { getPublicWelcomeCampaign } from '../../services/welcomeCampaign'
import { customerCanUseWelcomeOffer } from '../../services/welcomeOffer'
import { requireDatabase } from '../../utils/d1'
import { getCustomer } from '../../utils/customerAuth'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const database = requireDatabase(event)
  const campaign = await getPublicWelcomeCampaign(database)
  const customer = await getCustomer(event)
  return {
    campaign,
    eligibleForSignedInCustomer: customer
      ? Boolean(campaign && (await customerCanUseWelcomeOffer(database, customer.id)))
      : null,
  }
})
