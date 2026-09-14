import { getPublicStoreCurtain } from '../../services/storeCurtain'
import { requireDatabase } from '../../utils/d1'

export default defineEventHandler(async (event) => ({
  curtain: await getPublicStoreCurtain(requireDatabase(event)),
}))
