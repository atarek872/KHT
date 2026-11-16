import { buildSitemapXml } from '#shared/storefrontSeo'
import { getCatalog } from '../services/catalog'
import { getDatabase } from '../utils/d1'
import { getPublicStoreContent } from '../services/storeContent'

export default defineEventHandler(async (event) => {
  const catalog = await getCatalog(getDatabase(event), import.meta.dev)
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  const database = getDatabase(event)
  const faqEnabled = database
    ? await getPublicStoreContent(database)
        .then((result) => result.content.faqEnabled)
        .catch(() => false)
    : false
  return buildSitemapXml(catalog, faqEnabled)
})
