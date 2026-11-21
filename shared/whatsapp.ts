export const KHT_WHATSAPP_NUMBER = '201553815746'

export function khtWhatsAppLink(message: string) {
  return `https://wa.me/${KHT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
