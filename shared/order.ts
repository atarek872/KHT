import type { Catalog, CartLine } from './types.ts'

export function priceOrder(raw: unknown, catalog: Catalog) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12)
    throw new Error('Your bag must contain between 1 and 12 selections.')
  const grouped = new Map<string, CartLine>()
  for (const input of raw) {
    if (
      !input ||
      typeof input.id !== 'string' ||
      typeof input.size !== 'string' ||
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 10
    )
      throw new Error('Check the quantities in your bag.')
    const key = `${input.id}:${input.size}`
    const previous = grouped.get(key)
    grouped.set(key, {
      id: input.id,
      size: input.size,
      quantity: input.quantity + (previous?.quantity || 0),
    })
  }
  const items = [...grouped.values()].map((line) => {
    const product = catalog.products.find((p) => p.id === line.id)
    const size = product?.sizes.find((s) => s.name === line.size)
    if (!product || !size || line.quantity > size.stock || line.quantity > 10)
      throw new Error('A selected size or quantity is no longer available. Review your bag.')
    return {
      name: product.name,
      size: line.size,
      quantity: line.quantity,
      price: product.price,
      image: product.image,
    }
  })
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
  return { items, subtotal, shipping: 60, total: subtotal + 60 }
}
