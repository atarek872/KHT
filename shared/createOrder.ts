import type { AdminOrderDetail, OrderSource } from './adminOrder'

export interface CreateOrderCustomer {
  id?: string
  name: string
  phone: string
  email?: string
  address: string
  governorate: string
  city: string
}

export interface CreateOrderInput {
  requestId: string
  customer: CreateOrderCustomer
  items: { variantId: string; quantity: number }[]
  shippingGovernorate: string
  paymentMethod: 'cod'
  source: OrderSource
  couponCode?: string
  notes?: string
}

export interface OrderVariantOption {
  id: string
  productId: string
  productName: string
  sku: string
  size: string
  color: string
  unitPrice: number
  stock: number
}

export interface ShippingOption {
  governorate: string
  rate: number
}

export interface CreateOrderResources {
  variants: OrderVariantOption[]
  shipping: ShippingOption[]
  paymentMethods: { value: 'cod'; label: string }[]
  sources: OrderSource[]
}

export interface CreateOrderResult {
  order: AdminOrderDetail
}