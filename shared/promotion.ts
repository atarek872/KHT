export interface StorePromotion {
  announcementEnabled: boolean
  announcementMessage: { en: string; ar: string }
  announcementCode: string
  announcementLink: string
  announcementStartDate: string
  announcementEndDate: string
  freeShippingEnabled: boolean
  freeShippingStartDate: string
  freeShippingEndDate: string
  freeShippingWeekdays: number[]
}

export const DEFAULT_PROMOTION: StorePromotion = {
  announcementEnabled: false,
  announcementMessage: { en: '', ar: '' },
  announcementCode: '',
  announcementLink: '/cart',
  announcementStartDate: '',
  announcementEndDate: '',
  freeShippingEnabled: false,
  freeShippingStartDate: '',
  freeShippingEndDate: '',
  freeShippingWeekdays: [],
}

const cairoDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})
const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function cairoParts(now: Date) {
  const parts = Object.fromEntries(
    cairoDate.formatToParts(now).map((part) => [part.type, part.value]),
  )
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdays[parts.weekday || ''] ?? -1,
  }
}

export function cairoDay(now: Date) {
  return cairoParts(now).day
}

function within(day: string, start: string, end: string) {
  return (!start || day >= start) && (!end || day <= end)
}

export function activeStorePromotion(promotion: StorePromotion, now = new Date()) {
  const { day, weekday } = cairoParts(now)
  return {
    announcement:
      promotion.announcementEnabled &&
      within(day, promotion.announcementStartDate, promotion.announcementEndDate),
    freeShipping:
      promotion.freeShippingEnabled &&
      within(day, promotion.freeShippingStartDate, promotion.freeShippingEndDate) &&
      (!promotion.freeShippingWeekdays.length || promotion.freeShippingWeekdays.includes(weekday)),
  }
}

export function validateStorePromotion(value: StorePromotion) {
  if (!value || typeof value !== 'object') throw new Error('Promotion settings are required.')
  if (
    typeof value.announcementEnabled !== 'boolean' ||
    typeof value.freeShippingEnabled !== 'boolean'
  )
    throw new Error('Promotion switches must be on or off.')
  for (const [label, date] of [
    ['Announcement start', value.announcementStartDate],
    ['Announcement end', value.announcementEndDate],
    ['Free shipping start', value.freeShippingStartDate],
    ['Free shipping end', value.freeShippingEndDate],
  ] as const) {
    if (
      typeof date !== 'string' ||
      (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))))
    )
      throw new Error(`${label} must be a valid date.`)
  }
  if (
    value.announcementStartDate &&
    value.announcementEndDate &&
    value.announcementEndDate < value.announcementStartDate
  )
    throw new Error('Announcement end must follow its start.')
  if (
    value.freeShippingStartDate &&
    value.freeShippingEndDate &&
    value.freeShippingEndDate < value.freeShippingStartDate
  )
    throw new Error('Free shipping end must follow its start.')
  if (
    !Array.isArray(value.freeShippingWeekdays) ||
    value.freeShippingWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(value.freeShippingWeekdays).size !== value.freeShippingWeekdays.length
  )
    throw new Error('Choose valid free shipping weekdays.')
  if (
    typeof value.announcementCode !== 'string' ||
    (value.announcementCode && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(value.announcementCode))
  )
    throw new Error('Enter a valid promotion code.')
  if (
    typeof value.announcementLink !== 'string' ||
    !value.announcementLink.startsWith('/') ||
    value.announcementLink.startsWith('//')
  )
    throw new Error('Promotion link must be a store path.')
  for (const text of [value.announcementMessage?.en, value.announcementMessage?.ar]) {
    if (
      typeof text !== 'string' ||
      text.length > 180 ||
      (value.announcementEnabled && !text.trim())
    )
      throw new Error('Enter promotion text in English and Arabic (up to 180 characters).')
  }
  return value
}
