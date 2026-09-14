import type { D1Database } from '../utils/d1'
import type { Discount } from '../../shared/discount'
import { findDiscountByCode } from './discounts.ts'
import { getWelcomeCampaign } from './welcomeCampaign.ts'

export const WELCOME_DISCOUNT_CODE = 'WELCOME5'

interface CustomerDiscountOptions {
  userId?: string | null
  requestedCode?: string
  automaticWelcome?: boolean
}

async function discountEligibility(
  database: D1Database,
  userId: string | null | undefined,
  discount: Discount,
) {
  if ((discount.loginRequired || discount.oncePerCustomer || discount.firstOrderOnly) && !userId) {
    return { eligible: false, reason: 'login' as const }
  }
  if (discount.oncePerCustomer && userId) {
    const redemption = await database
      .prepare(
        `SELECT 1 AS found FROM customer_discount_redemptions
         WHERE user_id = ? AND discount_id = ? LIMIT 1`,
      )
      .bind(userId, discount.id)
      .first<{ found: number }>()
    if (redemption) return { eligible: false, reason: 'redeemed' as const }
  }
  if (discount.firstOrderOnly && userId) {
    const previousOrder = await database
      .prepare('SELECT 1 AS found FROM orders WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ found: number }>()
    if (previousOrder) return { eligible: false, reason: 'first-order' as const }
  }
  return { eligible: true }
}

export async function customerCanUseWelcomeOffer(database: D1Database, userId?: string | null) {
  const campaign = await getWelcomeCampaign(database)
  if (!campaign.enabled || !campaign.discount?.active) return false
  return (await discountEligibility(database, userId, campaign.discount)).eligible
}

function eligibilityError(reason?: 'login' | 'redeemed' | 'first-order') {
  if (reason === 'login') return new Error('This coupon is available to signed-in customers only.')
  if (reason === 'redeemed') return new Error('This coupon has already been used by this account.')
  return new Error('This coupon is available on your first order only.')
}

export async function resolveCustomerDiscountCode(
  database: D1Database,
  options: CustomerDiscountOptions = {},
) {
  const requestedCode = options.requestedCode?.trim().toUpperCase() || undefined
  if (requestedCode) {
    const requestedDiscount = await findDiscountByCode(database, requestedCode)
    if (!requestedDiscount) return requestedCode
    const eligibility = await discountEligibility(database, options.userId, requestedDiscount)
    if (!eligibility.eligible) throw eligibilityError(eligibility.reason)
    return requestedCode
  }
  if (!options.automaticWelcome) return undefined
  const campaign = await getWelcomeCampaign(database)
  const campaignDiscount = campaign.discount
  if (campaign.enabled && campaignDiscount?.active) {
    const eligibility = await discountEligibility(database, options.userId, campaignDiscount)
    if (eligibility.eligible) return campaignDiscount.code
  }
  return undefined
}

export async function isWelcomeCampaignDiscount(database: D1Database, discountId?: string | null) {
  if (!discountId) return null
  const campaign = await getWelcomeCampaign(database)
  return campaign.discount?.id === discountId ? campaign : null
}
