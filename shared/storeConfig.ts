export interface StoreContact {
  email: string
  phone: string
  whatsapp: string
  emailHref: string
  phoneHref: string
  whatsappHref: string
  configured: boolean
}

export function useStoreContact(): StoreContact {
  const config = useRuntimeConfig().public
  const email = String(config.storeContactEmail || '').trim()
  const phone = String(config.storePhone || '').trim()
  const whatsapp = String(config.storeWhatsApp || '').trim()
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
