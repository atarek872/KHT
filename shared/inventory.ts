export interface InventoryVariant {
  id: string
  productId: string
  productName: string
  category: string
  sku: string
  size: string
  color: string
  stock: number
  active: boolean
  lowStock: boolean
  updatedAt: string
}

export interface InventoryFilters {
  q?: string
  category?: string
  lowStock?: boolean
}