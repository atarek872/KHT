export type StoreCurtainMode = 'coming_soon' | 'under_construction' | 'custom'

export type StoreCurtainText = { en: string; ar: string }

export type StoreCurtainInput = {
  enabled: boolean
  mode: StoreCurtainMode
  title: StoreCurtainText
  message: StoreCurtainText
  imageUrl: string | null
  countdownEnabled: boolean
  launchAt: string | null
  autoDisableAtLaunch: boolean
  ctaEnabled: boolean
  ctaLabel: StoreCurtainText
  ctaUrl: string
}

export type StoreCurtain = StoreCurtainInput & {
  effectiveActive: boolean
  updatedAt: string
  updatedBy: string
}

export type PublicStoreCurtain = StoreCurtainInput & {
  enabled: true
  revision: string
}

export type PublicStoreCurtainPayload = { curtain: PublicStoreCurtain | null }
