import type { UserRole } from '@/store/auth/types';

/** Roles allowed to hard-delete EMA instruments and conjuntos (matches API + RLS). Quality: QUALITY_TEAM only. */
export const EMA_CATALOG_DELETE_ROLES: UserRole[] = [
  'QUALITY_TEAM',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
  'ADMIN_OPERATIONS',
];
