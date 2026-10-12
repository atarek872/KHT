export type CheckoutStep = 1 | 2 | 3
export type CheckoutField = 'name' | 'phone' | 'email' | 'governorate' | 'city' | 'address'

export type CheckoutDraft = Record<CheckoutField, string>

export function normalizeCheckoutPhone(value: string): string | null {
  if (!/^[+0-9٠-٩۰-۹ ()-]{7,20}$/.test(value.trim())) return null
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const easternDigits = '۰۱۲۳۴۵۶۷۸۹'
  let digits = value
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const arabicIndex = arabicDigits.indexOf(digit)
      return String(arabicIndex >= 0 ? arabicIndex : easternDigits.indexOf(digit))
    })
    .replace(/\D/g, '')
  if (digits.startsWith('0020')) digits = digits.slice(2)
  if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`
  return /^201[0125]\d{8}$/.test(digits) ? digits : null
}

export function invalidCheckoutFields(
  step: 1 | 2,
  draft: CheckoutDraft,
  availableGovernorates: string[],
): CheckoutField[] {
  const invalid: CheckoutField[] = []
  if (step === 1) {
    if (!draft.name.trim() || draft.name.trim().length > 100) invalid.push('name')
    if (!normalizeCheckoutPhone(draft.phone)) invalid.push('phone')
    const email = draft.email.trim()
    if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      invalid.push('email')
  } else {
    if (!availableGovernorates.includes(draft.governorate)) invalid.push('governorate')
    if (!draft.city.trim() || draft.city.trim().length > 100) invalid.push('city')
    if (!draft.address.trim() || draft.address.trim().length > 250) invalid.push('address')
  }
  return invalid
}
