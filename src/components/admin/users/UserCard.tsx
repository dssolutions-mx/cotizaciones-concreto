'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building2, Shield, Edit2, UserMinus, UserPlus, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserRole } from '@/store/auth/types';

interface UserCardProps {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: UserRole;
    is_active?: boolean;
    plant_name?: string;
    plant_code?: string;
    business_unit_name?: string;
    created_at: string;
  };
  onEdit: (user: any) => void;
  onToggleStatus: (userId: string, isActive: boolean) => void;
  onAssignPlant?: (user: any) => void;
  delay?: number;
}

const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
  SALES_AGENT: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  EXTERNAL_SALES_AGENT: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  QUALITY_TEAM: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  PLANT_MANAGER: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  EXECUTIVE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CREDIT_VALIDATOR: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  DOSIFICADOR: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  ADMIN_OPERATIONS: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  ADMINISTRATIVE: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  EXTERNAL_CLIENT: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
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

export function UserCard({ user, onEdit, onToggleStatus, onAssignPlant, delay = 0 }: UserCardProps) {
  const roleColor = roleColors[user.role] || roleColors.SALES_AGENT;
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin nombre';
  const isActive = user.is_active !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`glass-base rounded-xl p-5 border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
        !isActive ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{fullName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="h-3 w-3 text-gray-400" />
              <p className="text-sm text-gray-600 truncate">{user.email}</p>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            {onAssignPlant && (
              <DropdownMenuItem onClick={() => onAssignPlant(user)}>
                <Building2 className="h-4 w-4 mr-2" />
                Asignar Planta
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onToggleStatus(user.id, isActive)}
              className={isActive ? 'text-red-600' : 'text-green-600'}
            >
              {isActive ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Desactivar
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Activar
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Rol</span>
          <Badge className={`${roleColor.bg} ${roleColor.text} ${roleColor.border} border`}>
            <Shield className="h-3 w-3 mr-1" />
            {roleLabels[user.role]}
          </Badge>
        </div>

        {(user.plant_name || user.business_unit_name) && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ubicación</span>
            <div className="flex items-center gap-1 text-sm text-gray-700">
              <Building2 className="h-3 w-3" />
              {user.plant_name || user.business_unit_name}
              {user.plant_code && <span className="text-gray-500"> ({user.plant_code})</span>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Estado</span>
          <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-400">
            Creado: {new Date(user.created_at).toLocaleDateString('es-ES')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

