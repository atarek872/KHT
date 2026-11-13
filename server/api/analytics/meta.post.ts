import { getCatalog } from '../../services/catalog.ts'
import {
  enqueueMetaStatement,
  metaUserData,
  type MetaCommerceEvent,
  type MetaEvent,
} from '../../services/metaCapi.ts'
import { requireDatabase } from '../../utils/d1.ts'
import { metaRequestContext, scheduleMetaDelivery } from '../../utils/metaRequest.ts'
import { enforceRateLimit } from '../../utils/rateLimit.ts'
import { requireJsonBody, requireSameOrigin } from '../../utils/requestGuards.ts'
import { sanitizeCampaignAttribution } from '../../../shared/campaignAttribution.ts'
import { metaCartPayload, metaProductPayload } from '../../../shared/metaCommerce.ts'
import { sizePrice } from '../../../shared/productPricing.ts'

interface Input {
  eventName: MetaCommerceEvent
  eventId: string
  path: string
  productId?: string
  size?: string
  items?: { id: string; size: string; quantity: number }[]
  attribution?: unknown
}

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const database = requireDatabase(event)
  await enforceRateLimit(event, 'meta-commerce', 100, 60)
  const input = await requireJsonBody<Input>(event, 4_096)
  if (
    !['ViewContent', 'AddToCart', 'InitiateCheckout'].includes(input.eventName) ||
    !/^[a-f0-9-]{36}$/i.test(input.eventId)
  )
    throw createError({ statusCode: 400, statusMessage: 'Invalid event.' })
  const catalog = await getCatalog(database)
  const product = catalog.products.find((item) => item.id === input.productId)
  let customData: MetaEvent['custom_data']
  if (input.eventName === 'ViewContent') {
    if (!product) throw createError({ statusCode: 400, statusMessage: 'Product unavailable.' })
    customData = { ...metaProductPayload(product), currency: 'EGP', num_items: 1 }
  } else if (input.eventName === 'AddToCart') {
    if (!product || !product.sizes.some((size) => size.name === input.size))
      throw createError({ statusCode: 400, statusMessage: 'Size unavailable.' })
    customData = { ...metaProductPayload(product, input.size), currency: 'EGP', num_items: 1 }
  } else {
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20)
      throw createError({ statusCode: 400, statusMessage: 'Invalid bag.' })
    const lines = input.items.map((item) => {
      const selected = catalog.products.find((candidate) => candidate.id === item.id)
      if (
        !selected ||
        !selected.sizes.some((size) => size.name === item.size) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      )
        throw createError({ statusCode: 400, statusMessage: 'Invalid bag.' })
      return { ...item, product: selected }
    })
    const value = lines.reduce(
      (sum, line) => sum + sizePrice(line.product, line.size) * line.quantity,
      0,
    )
    customData = { ...metaCartPayload(lines, value), currency: 'EGP' }
  }
  const context = metaRequestContext(
    event,
    input.path,
    sanitizeCampaignAttribution(input.attribution),
  )
  const payload: MetaEvent = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: 'website',
    event_source_url: context.eventSourceUrl,
    ...(context.testEventCode ? { testEventCode: context.testEventCode } : {}),
    user_data: await metaUserData(context),
    custom_data: customData,
  }
  await enqueueMetaStatement(database, payload).run()
  scheduleMetaDelivery(event, database, input.eventName, input.eventId)
  return { accepted: true }
})
