'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@/store/auth/types';

interface RoleCardProps {
  role: UserRole;
  description: string;
  userCount: number;
  onClick: () => void;
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

export function RoleCard({ role, description, userCount, onClick, delay = 0 }: RoleCardProps) {
  const color = roleColors[role] || roleColors.SALES_AGENT;
  const label = roleLabels[role] || role;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={onClick}
      className={`glass-base rounded-xl p-5 border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${color.border}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color.bg} ${color.text}`}>
          <Shield className="h-6 w-6" />
        </div>
        <Badge className={`${color.bg} ${color.text} ${color.border} border`}>
          <Users className="h-3 w-3 mr-1" />
          {userCount}
        </Badge>
      </div>

      <h3 className="font-semibold text-gray-900 mb-2">{label}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
    </motion.div>
  );
}

