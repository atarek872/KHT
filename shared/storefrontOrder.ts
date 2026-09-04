import type {
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
} from './adminOrder.ts'

export interface StorefrontCheckoutCustomer {
  name: string
  phone: string
  email?: string
  address: string
  governorate: string
  city: string
}

export interface StorefrontCheckoutInput {
  requestId: string
  cartId: string
  customer: StorefrontCheckoutCustomer
  items: { id: string; size: string; quantity: number }[]
  shippingGovernorate: string
  paymentMethod: OrderPaymentMethod
  couponCode?: string
  notes?: string
}

export interface StorefrontOrderLine {
  productName: string
  variant: string
  image?: string
  quantity: number
  unitPrice: number
  total: number
}

export interface StorefrontOrderConfirmation {
  reference: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  subtotal: number
  shipping: number
  discount: number
  total: number
  discountCode?: string
  paymentMethod: OrderPaymentMethod
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  createdAt: string
  lines: StorefrontOrderLine[]
}

export interface StorefrontOrderView {
  reference: string
  subtotal: number
  shipping: number
  discount: number
  total: number
  discountCode?: string
  paymentMethod: OrderPaymentMethod
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  createdAt: string
  lines: StorefrontOrderLine[]
}
