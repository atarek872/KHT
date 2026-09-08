import type { CartLine } from './types'

export interface SavedCart {
  id: string
  version: number
  items: CartLine[]
  subtotal: number
  adjusted?: boolean
}
