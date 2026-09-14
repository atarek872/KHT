import type { Discount, DiscountType } from './discount'
import type { Localized } from './types'

export interface WelcomeCampaignInput {
  enabled: boolean
  discountId: string
  desktopDelaySeconds: number
  mobileDelaySeconds: number
  dismissalDays: number
  eyebrow: Localized
  title: Localized
  body: Localized
  primaryLabel: Localized
  primaryRedirect: string
  secondaryLabel: Localized
  secondaryRedirect: string
}

export interface WelcomeCampaign extends WelcomeCampaignInput {
  discount: Discount | null
  updatedAt: string
  updatedBy: string
}

export interface PublicWelcomeCampaign {
  enabled: true
  revision: string
  desktopDelaySeconds: number
  mobileDelaySeconds: number
  dismissalDays: number
  eyebrow: Localized
  title: Localized
  body: Localized
  primaryLabel: Localized
  primaryRedirect: string
  secondaryLabel: Localized
  secondaryRedirect: string
  loginRequired: boolean
  oncePerCustomer: boolean
  firstOrderOnly: boolean
  discount: { type: DiscountType; value: number }
}

export interface WelcomeCampaignAdminPayload {
  campaign: WelcomeCampaign
  discounts: Discount[]
}
