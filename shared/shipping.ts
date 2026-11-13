export interface ShippingZoneInput {
  governorate: string
  rate: number
  enabled: boolean
  etaMinDays?: number | null
  etaMaxDays?: number | null
}

export interface ShippingZone extends ShippingZoneInput {}
