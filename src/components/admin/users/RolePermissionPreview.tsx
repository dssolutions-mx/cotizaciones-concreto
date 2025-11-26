'use client';

import React from 'react';
import { Shield, Check, X } from 'lucide-react';
import type { UserRole } from '@/store/auth/types';

interface RolePermissionPreviewProps {
  role: UserRole;
}

const roleDescriptions: Record<UserRole, string> = {
  SALES_AGENT: 'Puede crear y editar cotizaciones, ver reportes básicos',
  EXTERNAL_SALES_AGENT: 'Vendedor externo con acceso limitado',
  QUALITY_TEAM: 'Gestiona recetas, ensayos y control de calidad',
  PLANT_MANAGER: 'Administra operaciones de planta, costos y producción',
  DOSIFICADOR: 'Acceso a dosificación y recetas',
  CREDIT_VALIDATOR: 'Valida créditos y aprobaciones financieras',
  EXECUTIVE: 'Acceso completo al sistema',
  ADMIN_OPERATIONS: 'Administración operativa del sistema',
  ADMINISTRATIVE: 'Acceso administrativo y financiero',
  EXTERNAL_CLIENT: 'Cliente externo con acceso al portal',
};

const rolePermissions: Record<UserRole, string[]> = {
  SALES_AGENT: ['Crear cotizaciones', 'Editar cotizaciones', 'Ver reportes'],
  EXTERNAL_SALES_AGENT: ['Crear cotizaciones', 'Ver reportes limitados'],
  QUALITY_TEAM: ['Gestionar recetas', 'Crear ensayos', 'Ver reportes de calidad'],
  PLANT_MANAGER: ['Gestionar costos', 'Ver producción', 'Administrar planta'],
  DOSIFICADOR: ['Ver recetas', 'Acceso a dosificación'],
  CREDIT_VALIDATOR: ['Validar créditos', 'Aprobar órdenes', 'Ver reportes financieros'],
  EXECUTIVE: ['Acceso completo', 'Gestionar usuarios', 'Ver todos los reportes'],
  ADMIN_OPERATIONS: ['Gestionar usuarios', 'Administrar sistema', 'Ver reportes'],
  ADMINISTRATIVE: ['Acceso financiero', 'Ver reportes', 'Gestionar pagos'],
  EXTERNAL_CLIENT: ['Ver órdenes', 'Ver entregas', 'Ver calidad'],
};

export function RolePermissionPreview({ role }: RolePermissionPreviewProps) {
  const permissions = rolePermissions[role] || [];
  const description = roleDescriptions[role] || '';

  return (
    <div className="glass-thin rounded-lg p-4 border mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">Permisos del Rol</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <div className="space-y-2">
        {permissions.map((permission, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-gray-700">{permission}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

