'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building2, ChevronDown, ChevronRight, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientAssociationChips } from './ClientAssociationChips';
import type { PortalUser } from '@/lib/supabase/clientPortalAdmin';

interface PortalUserCardProps {
  user: PortalUser;
  onRefresh?: () => void;
  delay?: number;
}

export function PortalUserCard({ user, onRefresh, delay = 0 }: PortalUserCardProps) {
  const [expanded, setExpanded] = useState(false);
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin nombre';
  const isActive = user.is_active !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`glass-base rounded-xl p-5 border transition-all duration-200 hover:shadow-lg ${
        !isActive ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
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
            <DropdownMenuItem>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Desactivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Client Associations - Always Visible */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Clientes Asociados</span>
          <Badge className="bg-purple-100 text-purple-800">
            {user.client_associations?.length || 0}
          </Badge>
        </div>
        <ClientAssociationChips associations={user.client_associations || []} />
      </div>

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
      >
        <span>{expanded ? 'Ocultar detalles' : 'Ver detalles'}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-gray-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Estado</span>
            <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Fecha de creación</span>
            <span className="text-sm text-gray-700">
              {new Date(user.created_at).toLocaleDateString('es-ES')}
            </span>
          </div>
          {user.client_associations && user.client_associations.length > 0 && (
            <div>
              <span className="text-sm text-gray-500 block mb-2">Roles por cliente:</span>
              <div className="space-y-1">
                {user.client_associations.map((assoc) => (
                  <div key={assoc.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{assoc.client_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {assoc.role_within_client === 'executive' ? 'Ejecutivo' : 'Usuario'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

