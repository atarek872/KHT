import test from 'node:test'
import assert from 'node:assert/strict'
import { activeStorePromotion, cairoDay, DEFAULT_PROMOTION } from '../shared/promotion.ts'

test('promotion dates are evaluated in Cairo and include the last selected day', () => {
  const promotion = {
    ...DEFAULT_PROMOTION,
    announcementEnabled: true,
    announcementStartDate: '2026-11-27',
    announcementEndDate: '2026-11-30',
    freeShippingEnabled: true,
    freeShippingStartDate: '2026-11-27',
    freeShippingEndDate: '2026-11-30',
    freeShippingWeekdays: [5, 6],
  }
  assert.equal(cairoDay(new Date('2026-11-26T22:30:00Z')), '2026-11-27')
  assert.equal(activeStorePromotion(promotion, new Date('2026-11-27T12:00:00Z')).freeShipping, true)
  assert.equal(
    activeStorePromotion(promotion, new Date('2026-11-29T12:00:00Z')).freeShipping,
    false,
  )
  assert.equal(activeStorePromotion(promotion, new Date('2026-11-30T21:59:59Z')).announcement, true)
  assert.equal(
    activeStorePromotion(promotion, new Date('2026-11-30T22:00:00Z')).announcement,
    false,
  )
})

test('disabled promotions never change the public offer', () => {
  assert.deepEqual(activeStorePromotion(DEFAULT_PROMOTION, new Date('2026-11-27T12:00:00Z')), {
    announcement: false,
    freeShipping: false,
  })
})
