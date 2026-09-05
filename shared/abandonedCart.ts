export type CartRecoveryState = 'active' | 'contacted' | 'dismissed' | 'converted' | 'recovered'

export interface AbandonedCartSummary {
  id: string
  customerName?: string
  phone?: string
  email?: string
  subtotal: number
  itemsCount: number
  lastActivity: string
  createdAt: string
  contactCapturedAt?: string
  recoveryState: CartRecoveryState
}

export interface CartRecoveryEvent {
  id: string
  fromState?: CartRecoveryState
  toState: CartRecoveryState
  actorEmail: string
  note?: string
  createdAt: string
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
  events: CartRecoveryEvent[]
}

export interface CartContactInput {
  name?: string
  phone?: string
  email?: string
}

export interface CartSnapshotInput {
  cartId: string
  items: { id: string; size: string; quantity: number }[]
  contact?: CartContactInput
}
