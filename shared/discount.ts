export type DiscountType = 'percentage' | 'fixed'

export interface DiscountInput {
  code: string
  type: DiscountType
  value: number
  minimumOrder?: number | null
  maximumDiscount?: number | null
  usageLimit?: number | null
  validFrom?: string | null
  validUntil?: string | null
  active: boolean
}

export interface Discount extends DiscountInput {
  id: string
  currentUsage: number
  updatedAt: string
}

export interface DiscountQuote {
  code: string
  discount: number
}

export interface OrderQuote {
  subtotal: number
  shipping: number
  discount: number
  total: number
  couponCode?: string
}