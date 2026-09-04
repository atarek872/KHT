import type { Localized } from './types'

export interface AdminCategoryInput {
  slug: string
  name: Localized
  image: string
  active: boolean
  sortOrder: number
}

export interface AdminCategory extends AdminCategoryInput {
  id: string
  productCount: number
  updatedAt: string
}