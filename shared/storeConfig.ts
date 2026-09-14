export interface StoreContact {
  email: string
  phone: string
  whatsapp: string
  emailHref: string
  phoneHref: string
  whatsappHref: string
  configured: boolean
}

export function useStoreContact(overrides?: {
  email?: string
  phone?: string
  whatsapp?: string
}): StoreContact {
  const config = useRuntimeConfig().public
  const email = String(overrides?.email ?? config.storeContactEmail ?? '').trim()
  const phone = String(overrides?.phone ?? config.storePhone ?? '').trim()
  const whatsapp = String(overrides?.whatsapp ?? config.storeWhatsApp ?? '').trim()
  const whatsappDigits = whatsapp.replace(/\D/g, '')

  return {
    email,
    phone,
    whatsapp,
    emailHref: email ? `mailto:${email}` : '',
    phoneHref: phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '',
    whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : '',
    configured: Boolean(email || phone || whatsapp),
  }
}
