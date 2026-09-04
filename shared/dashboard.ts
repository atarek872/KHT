import type { AbandonedCartSummary } from './abandonedCart'

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

export interface DashboardSnapshot {
  range: DashboardRange
  generatedAt: string
  metrics: DashboardMetric[]
  salesTrend: DashboardSection<{ date: string; sales: number }>
  recentOrders: DashboardSection<never>
  topProducts: DashboardSection<never>
  lowStock: DashboardSection<never>
  abandonedCarts: DashboardSection<AbandonedCartSummary>
}