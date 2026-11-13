import type { ShippingZone, ShippingZoneInput } from '../../shared/shipping'
import type { D1Database } from '../utils/d1'

type ShippingRow = Omit<ShippingZone, 'enabled'> & { enabled: number }
const mapZone = (row: ShippingRow): ShippingZone => ({ ...row, enabled: !!row.enabled })
export const demoShippingZones: ShippingZone[] = [
  { governorate: 'Cairo', rate: 60, enabled: true },
  { governorate: 'Giza', rate: 70, enabled: true },
  { governorate: 'Alexandria', rate: 90, enabled: true },
]

export function validateShippingZone(input: ShippingZoneInput) {
  if (!input.governorate?.trim()) throw new Error('Zone or governorate is required.')
  if (input.governorate.trim().length > 80) throw new Error('Zone or governorate is too long.')
  if (!Number.isInteger(input.rate) || input.rate < 0)
    throw new Error('Shipping rate must be a non-negative whole EGP amount.')
  const min = input.etaMinDays
  const max = input.etaMaxDays
  if (
    (min == null) !== (max == null) ||
    (min != null && (!Number.isInteger(min) || min < 1 || min > 30)) ||
    (max != null && (!Number.isInteger(max) || max < min! || max > 30))
  )
    throw new Error('Set both estimated delivery days between 1 and 30, or leave both blank.')
}

export async function listShippingZones(database: D1Database, enabledOnly = false) {
  const result = await database
    .prepare(
      `SELECT governorate, rate, enabled,
    eta_min_days AS etaMinDays, eta_max_days AS etaMaxDays FROM shipping_zones
    ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY governorate`,
    )
    .all<ShippingRow>()
  return (result.results || []).map(mapZone)
}

export async function getShippingZone(
  database: D1Database,
  governorate: string,
  requireEnabled = false,
) {
  const row = await database
    .prepare(
      `SELECT governorate, rate, enabled,
    eta_min_days AS etaMinDays, eta_max_days AS etaMaxDays FROM shipping_zones
    WHERE governorate = ? ${requireEnabled ? 'AND enabled = 1' : ''}`,
    )
    .bind(governorate.trim())
    .first<ShippingRow>()
  return row ? mapZone(row) : null
}

export async function createShippingZone(database: D1Database, input: ShippingZoneInput) {
  validateShippingZone(input)
  await database
    .prepare(
      `INSERT INTO shipping_zones
    (governorate, rate, enabled, eta_min_days, eta_max_days) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.governorate.trim(),
      input.rate,
      input.enabled ? 1 : 0,
      input.etaMinDays ?? null,
      input.etaMaxDays ?? null,
    )
    .run()
  return (await getShippingZone(database, input.governorate))!
}

export async function updateShippingZone(
  database: D1Database,
  currentGovernorate: string,
  input: ShippingZoneInput,
) {
  validateShippingZone(input)
  const result = await database
    .prepare(
      `UPDATE shipping_zones SET governorate = ?, rate = ?,
    enabled = ?, eta_min_days = ?, eta_max_days = ? WHERE governorate = ?`,
    )
    .bind(
      input.governorate.trim(),
      input.rate,
      input.enabled ? 1 : 0,
      input.etaMinDays ?? null,
      input.etaMaxDays ?? null,
      currentGovernorate,
    )
    .run()
  if (!result.meta?.changes) throw new Error('SHIPPING_ZONE_NOT_FOUND')
  return (await getShippingZone(database, input.governorate))!
}

export async function requireShippingRate(database: D1Database, governorate: string) {
  const zone = await getShippingZone(database, governorate, true)
  if (!zone) throw new Error('Shipping is not available for this governorate.')
  return zone
}

export async function getStorefrontShippingRate(
  database: D1Database | undefined,
  governorate: string,
) {
  if (database) return requireShippingRate(database, governorate)
  const zone = demoShippingZones.find((item) => item.governorate === governorate && item.enabled)
  if (!zone) throw new Error('Shipping is not available for this governorate.')
  return zone
}
