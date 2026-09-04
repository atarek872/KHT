export type OrderPaymentMethod = 'cod'
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type OrderFulfillmentStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
export type OrderSource =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'whatsapp'
  | 'phone'
  | 'admin'
  | 'other'

export interface AdminOrderCapabilities {
  search: boolean
  statusFilter: boolean
  paymentMethodFilter: boolean
  sourceFilter: boolean
  dateFilter: boolean
  statusTransitions: boolean
}

export interface AdminOrderSummary {
  id: string
  number: string
  customerName: string
  customerPhone: string
  total: number
  paymentMethod: OrderPaymentMethod
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  source: OrderSource
  createdAt: string
}

export interface AdminOrderLine {
  id: string
  productName: string
  variant: string
  quantity: number
  unitPrice: number
  total: number
}

export interface AdminOrderDetail extends AdminOrderSummary {
  customerEmail?: string
  address: string
  notes?: string
  subtotal: number
  shipping: number
  discount: number
  discountCode?: string
  lines: AdminOrderLine[]
  allowedFulfillmentTransitions: OrderFulfillmentStatus[]
}

export interface AdminOrderListResponse {
  availability: 'available' | 'empty' | 'unavailable'
  message: string
  capabilities: AdminOrderCapabilities
  items: AdminOrderSummary[]
  total: number
}

export interface AdminOrderDetailResponse {
  availability: 'available' | 'unavailable' | 'not-found'
  message: string
  capabilities: AdminOrderCapabilities
  order: AdminOrderDetail | null
}