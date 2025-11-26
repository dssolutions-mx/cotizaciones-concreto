'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/store/auth/types';

interface RoleDetailViewProps {
  role: UserRole;
  users: any[];
  onClose: () => void;
}

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

const permissionLabels: Record<string, string> = {
  CREATE_RECIPE: 'Crear Recetas',
  EDIT_RECIPE: 'Editar Recetas',
  DELETE_RECIPE: 'Eliminar Recetas',
  CREATE_QUOTE: 'Crear Cotizaciones',
  EDIT_QUOTE: 'Editar Cotizaciones',
  APPROVE_QUOTE: 'Aprobar Cotizaciones',
  VIEW_ALL_QUOTES: 'Ver Todas las Cotizaciones',
  MANAGE_MATERIAL_PRICES: 'Gestionar Precios de Materiales',
  MANAGE_ADMIN_COSTS: 'Gestionar Costos Administrativos',
  MANAGE_USERS: 'Gestionar Usuarios',
  VIEW_REPORTS: 'Ver Reportes',
};

export function RoleDetailView({ role, users, onClose }: RoleDetailViewProps) {
  const permissions = rolePermissions[role] || [];
  const label = roleLabels[role] || role;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {label}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions">Permisos</TabsTrigger>
            <TabsTrigger value="users">
              Usuarios ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="mt-4">
            <div className="glass-thin rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-4">Permisos Asignados</h3>
              {permissions.length > 0 ? (
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div key={permission} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        {permissionLabels[permission] || permission}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Este rol no tiene permisos asignados</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <div className="glass-thin rounded-lg p-4">
              {users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.first_name || ''} {user.last_name || ''}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <Badge className={user.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.is_active !== false ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay usuarios asignados a este rol
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

