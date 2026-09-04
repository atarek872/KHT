export type CartRecoveryState = 'unavailable' | 'not-started' | 'recovered'

export interface AbandonedCartSummary {
  id: string
  customerName?: string
  phone?: string
  email?: string
  subtotal: number
  itemsCount: number
  lastActivity: string
  createdAt: string
  recoveryState: CartRecoveryState
}

export interface AbandonedCartItem {
  id: string
  productId: string
  productName: string
  variant: string
  image: string
  quantity: number
  unitPrice: number
  total: number
}

export interface AbandonedCartDetail extends AbandonedCartSummary {
  items: AbandonedCartItem[]
}

export interface CartSnapshotInput {
  cartId: string
  items: { id: string; size: string; quantity: number }[]
}