import type { AdminOrderSummary } from './adminOrder'

export interface AdminCustomerSummary {
  id: string
  name: string
  phone: string
  email?: string
  ordersCount: number
  totalSpent: number
  lastOrderAt?: string
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  address: string
  governorate: string
  city: string
  createdAt: string
  orders: AdminOrderSummary[]
}

export interface CustomerSearchResult {
  id: string
  name: string
  phone: string
  email?: string
  address: string
  governorate: string
  city: string
}