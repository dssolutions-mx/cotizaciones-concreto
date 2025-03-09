import { UserRole } from '@/contexts/AuthContext';

/**
 * Type definitions for permission checking
 */
export type PermissionCheck = {
  role: UserRole;
  allowedRoles: UserRole[];
  action: string;
  expected: boolean;
};

/**
 * Validates if a user's role has permission to perform an action based on allowed roles
 */
export function checkPermission(userRole: UserRole | null | undefined, allowedRoles: UserRole | UserRole[]): boolean {
  if (!userRole) return false;
  
  if (Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }
  
  return userRole === allowedRoles;
}

/**
 * Maps RBAC permission levels to human-readable descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'SALES_AGENT': 'Agente de Ventas',
  'QUALITY_TEAM': 'Equipo de Calidad',
  'PLANT_MANAGER': 'Gerente de Planta',
  'EXECUTIVE': 'Ejecutivo'
};

/**
 * Test cases for RBAC validation
 */
export const ROLE_TEST_CASES: PermissionCheck[] = [
  // Sales Agent permissions
  { role: 'SALES_AGENT', allowedRoles: ['SALES_AGENT'], action: 'crear cotizaciones', expected: true },
  { role: 'SALES_AGENT', allowedRoles: ['PLANT_MANAGER', 'EXECUTIVE'], action: 'aprobar cotizaciones', expected: false },
  { role: 'SALES_AGENT', allowedRoles: ['QUALITY_TEAM', 'EXECUTIVE'], action: 'gestionar recetas', expected: false },
  { role: 'SALES_AGENT', allowedRoles: ['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE'], action: 'gestionar clientes', expected: true },

  // Quality Team permissions
  { role: 'QUALITY_TEAM', allowedRoles: ['SALES_AGENT'], action: 'crear cotizaciones', expected: false },
  { role: 'QUALITY_TEAM', allowedRoles: ['QUALITY_TEAM', 'EXECUTIVE'], action: 'gestionar recetas', expected: true },
  { role: 'QUALITY_TEAM', allowedRoles: ['QUALITY_TEAM', 'EXECUTIVE'], action: 'gestionar precios de materiales', expected: true },
  { role: 'QUALITY_TEAM', allowedRoles: ['PLANT_MANAGER', 'EXECUTIVE'], action: 'gestionar costos administrativos', expected: false },

  // Plant Manager permissions
  { role: 'PLANT_MANAGER', allowedRoles: ['PLANT_MANAGER', 'EXECUTIVE'], action: 'aprobar cotizaciones', expected: true },
  { role: 'PLANT_MANAGER', allowedRoles: ['QUALITY_TEAM', 'EXECUTIVE'], action: 'gestionar recetas', expected: false },
  { role: 'PLANT_MANAGER', allowedRoles: ['PLANT_MANAGER', 'EXECUTIVE'], action: 'gestionar costos administrativos', expected: true },

  // Executive permissions (should have access to everything)
  { role: 'EXECUTIVE', allowedRoles: ['SALES_AGENT'], action: 'crear cotizaciones', expected: false },
  { role: 'EXECUTIVE', allowedRoles: ['EXECUTIVE'], action: 'ver estadísticas', expected: true },
  { role: 'EXECUTIVE', allowedRoles: ['QUALITY_TEAM', 'EXECUTIVE'], action: 'gestionar recetas', expected: true },
  { role: 'EXECUTIVE', allowedRoles: ['PLANT_MANAGER', 'EXECUTIVE'], action: 'aprobar cotizaciones', expected: true },
];

/**
 * Validates a set of role permission test cases
 * @returns Object with test results
 */
export function validateRoleChecks(): { 
  passed: PermissionCheck[]; 
  failed: PermissionCheck[]; 
  passRate: string 
} {
  const passed: PermissionCheck[] = [];
  const failed: PermissionCheck[] = [];
  
  ROLE_TEST_CASES.forEach(testCase => {
    const result = checkPermission(testCase.role, testCase.allowedRoles);
    if (result === testCase.expected) {
      passed.push(testCase);
    } else {
      failed.push(testCase);
    }
  });
  
  const passRate = ((passed.length / ROLE_TEST_CASES.length) * 100).toFixed(1) + '%';
  
  return { passed, failed, passRate };
} 