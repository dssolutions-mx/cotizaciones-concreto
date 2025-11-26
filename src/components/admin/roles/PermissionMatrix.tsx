'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import type { UserRole } from '@/store/auth/types';

const permissions = [
  { id: 'CREATE_RECIPE', label: 'Crear Recetas' },
  { id: 'EDIT_RECIPE', label: 'Editar Recetas' },
  { id: 'DELETE_RECIPE', label: 'Eliminar Recetas' },
  { id: 'CREATE_QUOTE', label: 'Crear Cotizaciones' },
  { id: 'EDIT_QUOTE', label: 'Editar Cotizaciones' },
  { id: 'APPROVE_QUOTE', label: 'Aprobar Cotizaciones' },
  { id: 'VIEW_ALL_QUOTES', label: 'Ver Todas las Cotizaciones' },
  { id: 'MANAGE_MATERIAL_PRICES', label: 'Gestionar Precios de Materiales' },
  { id: 'MANAGE_ADMIN_COSTS', label: 'Gestionar Costos Administrativos' },
  { id: 'MANAGE_USERS', label: 'Gestionar Usuarios' },
  { id: 'VIEW_REPORTS', label: 'Ver Reportes' },
];

const rolePermissions: Record<UserRole, string[]> = {
  QUALITY_TEAM: ['CREATE_RECIPE', 'EDIT_RECIPE', 'DELETE_RECIPE', 'VIEW_REPORTS'],
  PLANT_MANAGER: ['CREATE_QUOTE', 'EDIT_QUOTE', 'APPROVE_QUOTE', 'VIEW_ALL_QUOTES', 'MANAGE_ADMIN_COSTS', 'VIEW_REPORTS'],
  SALES_AGENT: ['CREATE_QUOTE', 'EDIT_QUOTE', 'VIEW_REPORTS'],
  EXTERNAL_SALES_AGENT: ['CREATE_QUOTE', 'EDIT_QUOTE', 'VIEW_REPORTS'],
  EXECUTIVE: ['CREATE_RECIPE', 'EDIT_RECIPE', 'DELETE_RECIPE', 'CREATE_QUOTE', 'EDIT_QUOTE', 'APPROVE_QUOTE', 'VIEW_ALL_QUOTES', 'MANAGE_MATERIAL_PRICES', 'MANAGE_ADMIN_COSTS', 'MANAGE_USERS', 'VIEW_REPORTS'],
  CREDIT_VALIDATOR: ['VIEW_REPORTS'],
  DOSIFICADOR: ['VIEW_REPORTS'],
  ADMIN_OPERATIONS: ['MANAGE_USERS', 'VIEW_REPORTS'],
  ADMINISTRATIVE: ['VIEW_REPORTS'],
  EXTERNAL_CLIENT: [],
};

const roleLabels: Record<UserRole, string> = {
  SALES_AGENT: 'Vendedor',
  EXTERNAL_SALES_AGENT: 'Vendedor Externo',
  QUALITY_TEAM: 'Equipo de Calidad',
  PLANT_MANAGER: 'Jefe de Planta',
  EXECUTIVE: 'Directivo',
  CREDIT_VALIDATOR: 'Validador de Crédito',
  DOSIFICADOR: 'Dosificador',
  ADMIN_OPERATIONS: 'Admin Operaciones',
  ADMINISTRATIVE: 'Administrativo',
  EXTERNAL_CLIENT: 'Cliente Externo',
};

const allRoles: UserRole[] = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'QUALITY_TEAM',
  'SALES_AGENT',
  'EXTERNAL_SALES_AGENT',
  'CREDIT_VALIDATOR',
  'DOSIFICADOR',
  'ADMINISTRATIVE',
  'EXTERNAL_CLIENT',
];

export function PermissionMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Permiso</th>
            {allRoles.map((role) => (
              <th key={role} className="text-center py-3 px-4 font-semibold text-gray-700 border-b text-sm">
                {roleLabels[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-700">{permission.label}</td>
              {allRoles.map((role) => {
                const hasPermission = rolePermissions[role]?.includes(permission.id) || false;
                return (
                  <td key={role} className="py-3 px-4 text-center">
                    {hasPermission ? (
                      <Check className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

