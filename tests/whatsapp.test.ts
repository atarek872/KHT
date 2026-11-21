import assert from 'node:assert/strict'
import test from 'node:test'
import { khtWhatsAppLink } from '../shared/whatsapp.ts'

test('KHT WhatsApp messages keep the product and selected size in the encoded link', () => {
  const link = new URL(khtWhatsAppLink('KHT LINE 01 Full Set · مقاس M'))
  assert.equal(link.origin, 'https://wa.me')
  assert.equal(link.pathname, '/201553815746')
  assert.equal(link.searchParams.get('text'), 'KHT LINE 01 Full Set · مقاس M')
})
