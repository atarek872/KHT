import { buildSitemapXml } from '#shared/storefrontSeo'
import { getCatalog } from '../services/catalog'
import { getDatabase } from '../utils/d1'

export default defineEventHandler(async (event) => {
  const catalog = await getCatalog(getDatabase(event), import.meta.dev)
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  return buildSitemapXml(catalog)
})
