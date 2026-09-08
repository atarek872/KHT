export interface CustomerMailConfig {
  CF_EMAIL_ACCOUNT_ID?: string
  CF_EMAIL_TOKEN?: string
  MAIL_FROM?: string
  PUBLIC_SITE_URL?: string
}
export function mailConfigured(config: CustomerMailConfig) {
  try {
    return Boolean(
      config.CF_EMAIL_ACCOUNT_ID &&
      config.CF_EMAIL_TOKEN &&
      config.MAIL_FROM &&
      config.PUBLIC_SITE_URL &&
      new URL(config.PUBLIC_SITE_URL).protocol === 'https:',
    )
  } catch {
    return false
  }
}
export async function sendPasswordReset(config: CustomerMailConfig, email: string, token: string) {
  if (!mailConfigured(config)) throw new Error('Password reset is temporarily unavailable.')
  const url = new URL('/account/reset-password', config.PUBLIC_SITE_URL)
  url.hash = `token=${encodeURIComponent(token)}`
  const text = `Reset your KHT password using this link (valid for 30 minutes):\n\n${url.href}\n\nIf you did not request this, you can ignore this email.`
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.CF_EMAIL_ACCOUNT_ID!)}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.CF_EMAIL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        from: config.MAIL_FROM,
        subject: 'Reset your KHT password',
        text,
      }),
      signal: AbortSignal.timeout(15000),
    },
  )
  const result = (await response.json()) as {
    success?: boolean
    result?: { permanent_bounces?: unknown[] }
  }
  if (!response.ok || !result.success || result.result?.permanent_bounces?.length)
    throw new Error('Password reset is temporarily unavailable.')
}
