import type { UserRole } from '@/store/auth/types';

/** Roles that may edit instrument fichas (matches PUT /api/ema/instrumentos/[id]). */
export const EMA_INSTRUMENT_UPDATE_ROLES: UserRole[] = [
  'QUALITY_TEAM',
  'LABORATORY',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
  'ADMIN_OPERATIONS',
];

/** Conjunto catalog edits — aligned with instrument update (calidad + laboratorio + managers). */
export const EMA_CONJUNTO_UPDATE_ROLES: UserRole[] = [...EMA_INSTRUMENT_UPDATE_ROLES];

export const EMA_MANAGER_ROLES: UserRole[] = [
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
  'ADMIN_OPERATIONS',
];
