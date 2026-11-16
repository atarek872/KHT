export interface PublicWelcomePriceCampaign {
  loginRequired: boolean
  oncePerCustomer: boolean
  firstOrderOnly: boolean
  discount: {
    code: string
    type: 'percentage' | 'fixed'
    value: number
    minimumOrder: number | null
    maximumDiscount: number | null
  }
}

// A pre-shipping estimate for a product or cart subtotal. Checkout remains
// authoritative for customer eligibility, discounts, shipping and final total.
export function firstOrderWelcomePrice(
  salePrice: number,
  campaign: PublicWelcomePriceCampaign | null | undefined,
): number | null {
  if (
    !Number.isInteger(salePrice) ||
    salePrice <= 0 ||
    !campaign?.loginRequired ||
    !campaign.oncePerCustomer ||
    !campaign.firstOrderOnly ||
    campaign.discount.code !== 'WELCOME10' ||
    campaign.discount.type !== 'percentage' ||
    campaign.discount.value !== 10 ||
    (campaign.discount.minimumOrder != null && salePrice < campaign.discount.minimumOrder)
  )
    return null
  const discount = Math.floor((salePrice * campaign.discount.value) / 100)
  if (campaign.discount.maximumDiscount != null && discount > campaign.discount.maximumDiscount)
    return null
  return salePrice - discount
}
