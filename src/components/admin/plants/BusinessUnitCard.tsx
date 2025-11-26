'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Edit2, Trash2, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BusinessUnitCardProps {
  businessUnit: {
    id: string;
    code: string;
    name: string;
    description?: string;
    is_active: boolean;
  };
  plantCount?: number;
  onEdit: (bu: any) => void;
  onDelete: (id: string) => void;
  onViewPlants?: (buId: string) => void;
  delay?: number;
}

export function BusinessUnitCard({
  businessUnit,
  plantCount = 0,
  onEdit,
  onDelete,
  onViewPlants,
  delay = 0,
}: BusinessUnitCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="glass-base rounded-xl p-5 border transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-3 rounded-lg ${businessUnit.is_active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{businessUnit.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{businessUnit.code}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onViewPlants && (
            <button
              onClick={() => onViewPlants(businessUnit.id)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
              title="Ver plantas"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(businessUnit)}
            className="p-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-600"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(businessUnit.id)}
            className="p-2 rounded-lg hover:bg-red-100 transition-colors text-red-600"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {businessUnit.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{businessUnit.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Badge className={businessUnit.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {businessUnit.is_active ? 'Activa' : 'Inactiva'}
          </Badge>
          {plantCount > 0 && (
            <span className="text-sm text-gray-500">
              {plantCount} {plantCount === 1 ? 'planta' : 'plantas'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

