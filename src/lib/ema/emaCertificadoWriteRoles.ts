import type { UserRole } from '@/store/auth/types'

/** Matches write access for EMA calibration certificate routes (POST/PATCH, upload). */
export const EMA_CERTIFICADO_WRITE_ROLES: UserRole[] = [
  'QUALITY_TEAM',
  'LABORATORY',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
]
