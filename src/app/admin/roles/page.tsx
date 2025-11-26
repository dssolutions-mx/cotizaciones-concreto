'use client';

import React, { useState, useMemo } from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Shield, Users, Check, X, Search } from 'lucide-react';
import { authService } from '@/lib/supabase/auth';
import { PermissionMatrix } from '@/components/admin/roles/PermissionMatrix';
import { RoleCard } from '@/components/admin/roles/RoleCard';
import { RoleDetailView } from '@/components/admin/roles/RoleDetailView';
import { Input } from '@/components/ui/input';
import type { UserRole } from '@/store/auth/types';

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

const allRoles: UserRole[] = [
  'SALES_AGENT',
  'EXTERNAL_SALES_AGENT',
  'QUALITY_TEAM',
  'PLANT_MANAGER',
  'DOSIFICADOR',
  'CREDIT_VALIDATOR',
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
  'EXTERNAL_CLIENT',
];

export default function RoleManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authService.getAllUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const roleStats = useMemo(() => {
    const stats: Record<UserRole, number> = {} as Record<UserRole, number>;
    allRoles.forEach(role => {
      stats[role] = users.filter(u => u.role === role).length;
    });
    return stats;
  }, [users]);

  const filteredRoles = useMemo(() => {
    if (!searchTerm) return allRoles;
    const term = searchTerm.toLowerCase();
    return allRoles.filter(role =>
      role.toLowerCase().includes(term) ||
      roleDescriptions[role]?.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gestión de Roles</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra roles y permisos del sistema
          </p>
        </div>

        {/* Search */}
        <div className="glass-base rounded-xl p-4 mb-6 border">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Buscar roles..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredRoles.map((role, index) => (
            <RoleCard
              key={role}
              role={role}
              description={roleDescriptions[role]}
              userCount={roleStats[role]}
              onClick={() => setSelectedRole(role)}
              delay={index * 0.05}
            />
          ))}
        </div>

        {/* Permission Matrix */}
        <div className="glass-base rounded-xl p-6 mb-6 border">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Matriz de Permisos
          </h2>
          <PermissionMatrix />
        </div>

        {/* Role Detail View */}
        {selectedRole && (
          <RoleDetailView
            role={selectedRole}
            users={users.filter(u => u.role === selectedRole)}
            onClose={() => setSelectedRole(null)}
          />
        )}
      </div>
    </RoleGuard>
  );
}

