import type { UserRole } from '@/store/auth/types';

/** Roles that may create and edit remisiones (concrete and pumping), matching dosificador workflows. */
export const REMISION_CREATE_EDIT_ROLES = [
  'DOSIFICADOR',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'CREDIT_VALIDATOR',
] as const satisfies readonly UserRole[];

export function canManageRemisiones(role: string | undefined | null): boolean {
  if (!role) return false;
  return (REMISION_CREATE_EDIT_ROLES as readonly string[]).includes(role);
}
