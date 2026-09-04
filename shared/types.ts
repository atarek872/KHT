export type Locale = 'en' | 'ar'
export type Localized = { en: string; ar: string }
export interface Category {
  slug: string
  name: Localized
  image: string
}
export interface Product {
  id: string
  slug: string
  name: Localized
  category: string
  price: number
  image: string
  description: Localized
  detail: Localized
  fit: Localized
  sizes: { name: string; stock: number }[]
  code: string
}
export interface Catalog {
  products: Product[]
  categories: Category[]
  demo: boolean
}
export interface CartLine {
  id: string
  size: string
  quantity: number
}
export interface DemoOrder {
  reference: string
  createdAt: string
  subtotal: number
  shipping: number
  discount: number
  couponCode?: string
  total: number
  items: { name: Localized; size: string; quantity: number; price: number; image: string }[]
  demo: true
}
