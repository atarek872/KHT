import { getRecoveryAdminSettings } from '../../services/recoveryAdminSettings'
import { getDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=30')
  const database = getDatabase(event)
  if (!database) return { enabled: false }
  const settings = await getRecoveryAdminSettings(database)
  return { enabled: settings.enabled && settings.hasApiKey && Boolean(settings.senderEmail) }
})
