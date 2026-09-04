import type { Catalog, CartLine } from './types.ts'

export function groupOrderLines(
  lines: { key: string; quantity: number }[],
  maximumSelections = 12,
) {
  if (lines.length < 1 || lines.length > maximumSelections)
    throw new Error(`An order must contain between 1 and ${maximumSelections} selections.`)
  const grouped = new Map<string, number>()
  for (const line of lines) {
    if (!line.key || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10)
      throw new Error('Check the quantities in your order.')
    grouped.set(line.key, (grouped.get(line.key) || 0) + line.quantity)
  }
  return grouped
}

export function assertAvailableStock(quantity: number, stock: number) {
  if (quantity > stock || quantity > 10)
    throw new Error('A selected variant does not have enough stock.')
}

export function calculateOrderTotal(subtotal: number, discount: number, shipping: number) {
  if (![subtotal, discount, shipping].every((value) => Number.isInteger(value) && value >= 0))
    throw new Error('Order amounts must be non-negative whole EGP values.')
  if (discount > subtotal) throw new Error('Discount cannot exceed the subtotal.')
  return subtotal - discount + shipping
}

export function priceOrder(raw: unknown, catalog: Catalog, shipping = 60) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12)
    throw new Error('Your bag must contain between 1 and 12 selections.')
  const validLines: CartLine[] = []
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
    validLines.push({ id: input.id, size: input.size, quantity: input.quantity })
  }
  const grouped = groupOrderLines(
    validLines.map((line) => ({ key: `${line.id}:${line.size}`, quantity: line.quantity })),
  )
  const items = [...grouped].map(([key, quantity]) => {
    const [id, sizeName] = key.split(':')
    const product = catalog.products.find((p) => p.id === id)
    const size = product?.sizes.find((s) => s.name === sizeName)
    if (!product || !size)
      throw new Error('A selected size or quantity is no longer available. Review your bag.')
    assertAvailableStock(quantity, size.stock)
    return {
      name: product.name,
      size: sizeName!,
      quantity,
      price: product.price,
      image: product.image,
    }
  })
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
  return { items, subtotal, shipping, total: calculateOrderTotal(subtotal, 0, shipping) }
}
