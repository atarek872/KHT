import { requireAdmin } from '../../../utils/adminAuth'
import { getRecoveryAdminSettings } from '../../../services/recoveryAdminSettings'

export default defineEventHandler(async (event) =>
  getRecoveryAdminSettings((await requireAdmin(event)).database),
)
