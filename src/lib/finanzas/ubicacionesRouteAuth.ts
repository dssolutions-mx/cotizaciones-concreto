/** Matches roles allowed by `src/app/finanzas/layout.tsx`. */
export const FINANZAS_UBICACIONES_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'SALES_AGENT',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
  'ADMIN',
] as const;

export type FinanzasUbicacionesRole = (typeof FINANZAS_UBICACIONES_ROLES)[number];

export function canAccessFinanzasUbicaciones(role: string | null | undefined): boolean {
  if (!role) return false;
  return (FINANZAS_UBICACIONES_ROLES as readonly string[]).includes(role);
}

export function isPlantLockedFinanzasRole(role: string | null | undefined): boolean {
  return role === 'PLANT_MANAGER';
}
