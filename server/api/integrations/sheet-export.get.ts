import { getSheetExportPage, verifySheetSyncToken } from '../../services/sheetExport'
import { requireDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const cloudflare = event.context.cloudflare as { env?: { SHEET_SYNC_TOKEN?: string } } | undefined
  const configured = cloudflare?.env?.SHEET_SYNC_TOKEN || ''
  if (!configured) throw createError({ statusCode: 503, statusMessage: 'Sheet export is not configured.' })
  const authorization = getHeader(event, 'authorization') || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!await verifySheetSyncToken(provided, configured))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })

  const rawCursor = getQuery(event).cursor
  const cursor = rawCursor === undefined ? 0 : Number(rawCursor)
  if (!Number.isSafeInteger(cursor) || cursor < 0)
    throw createError({ statusCode: 400, statusMessage: 'Invalid export page.' })
  return getSheetExportPage(requireDatabase(event), cursor)
})
