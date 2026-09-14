import { getPublicStoreContent } from '../../services/storeContent'
import { requireDatabase } from '../../utils/d1'

export default defineEventHandler((event) => getPublicStoreContent(requireDatabase(event)))
