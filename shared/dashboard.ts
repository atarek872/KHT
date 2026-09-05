import type { AbandonedCartSummary } from './abandonedCart'
import type { OrderFulfillmentStatus, OrderPaymentStatus } from './adminOrder'

export type DashboardRange = 'today' | '7d' | '30d'
export type DashboardAvailability = 'available' | 'empty' | 'unavailable'

export interface DashboardMetric {
  key:
    | 'sales'
    | 'orders'
    | 'averageOrderValue'
    | 'itemsSold'
    | 'lowStock'
    | 'abandonedCarts'
    | 'recoveredCarts'
    | 'recoveredRevenue'
  label: string
  format: 'currency' | 'number'
  value: number | null
  availability: DashboardAvailability
  note: string
}

export interface DashboardSection<T> {
  availability: DashboardAvailability
  message: string
  items: T[]
}

export interface DashboardRecentOrder {
  id: string
  number: string
  customerName: string
  total: number
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  createdAt: string
}

export interface DashboardTopProduct {
  productName: string
  quantity: number
  revenue: number
}

export interface DashboardLowStockItem {
  id: string
  productName: string
  sku: string
  size: string
  color: string
  stock: number
}

export interface DashboardSnapshot {
  range: DashboardRange
  generatedAt: string
  metrics: DashboardMetric[]
  salesTrend: DashboardSection<{ date: string; sales: number }>
  recentOrders: DashboardSection<DashboardRecentOrder>
  topProducts: DashboardSection<DashboardTopProduct>
  lowStock: DashboardSection<DashboardLowStockItem>
  abandonedCarts: DashboardSection<AbandonedCartSummary>
}
