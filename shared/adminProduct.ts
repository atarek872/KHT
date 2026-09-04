import type { Localized } from './types'

export interface AdminProductVariant {
  id?: string
  sku: string
  size: string
  color: string
  stock: number
  active: boolean
}

export interface AdminProductInput {
  slug: string
  code: string
  category: string
  price: number
  image: string
  name: Localized
  description: Localized
  detail: Localized
  fit: Localized
  active: boolean
  variants: AdminProductVariant[]
}

export interface AdminProduct extends AdminProductInput {
  id: string
  updatedAt: string
}

export interface AdminProductSummary {
  id: string
  slug: string
  code: string
  name: Localized
  category: string
  price: number
  image: string
  stock: number
  active: boolean
  updatedAt: string
}