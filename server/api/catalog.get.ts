import { getCatalog } from '../services/catalog'
import { getDatabase } from '../utils/d1'

export default defineEventHandler((event) => getCatalog(getDatabase(event)))
