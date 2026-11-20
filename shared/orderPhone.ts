export function normalizeEgyptianPhone(value: string) {
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
  if (!/^201[0125]\d{8}$/.test(digits)) {
    throw new Error('Enter a valid Egyptian mobile number.')
  }
  return digits
}

export function normalizeAdminPhone(value: string, country: 'EG' | 'US' = 'EG') {
  if (country === 'EG') return normalizeEgyptianPhone(value)
  if (country !== 'US') throw new Error('Choose a valid phone country.')
  const digits = value.trim().replace(/[^0-9]/g, '')
  const national = digits.startsWith('001')
    ? digits.slice(3)
    : digits.startsWith('1') && digits.length === 11
      ? digits.slice(1)
      : digits
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national))
    throw new Error('Enter a valid US phone number with 10 digits or +1.')
  return `1${national}`
}
