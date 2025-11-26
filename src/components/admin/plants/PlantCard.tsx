'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Edit2, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlantCardProps {
  plant: {
    id: string;
    code: string;
    name: string;
    location?: string;
    is_active: boolean;
    business_unit?: {
      id: string;
      name: string;
      code: string;
    };
  };
  userCount?: number;
  onEdit: (plant: any) => void;
  onDelete: (id: string) => void;
  onViewDetails?: (plantId: string) => void;
  delay?: number;
}

export function PlantCard({
  plant,
  userCount = 0,
  onEdit,
  onDelete,
  onViewDetails,
  delay = 0,
}: PlantCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="glass-base rounded-xl p-5 border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
      onClick={() => onViewDetails?.(plant.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-3 rounded-lg ${plant.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{plant.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{plant.code}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(plant)}
            className="p-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-600"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(plant.id)}
            className="p-2 rounded-lg hover:bg-red-100 transition-colors text-red-600"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {plant.location && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>{plant.location}</span>
        </div>
      )}

      {plant.business_unit && (
        <div className="mb-3">
          <Badge variant="outline" className="text-xs">
            {plant.business_unit.name}
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Badge className={plant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {plant.is_active ? 'Activa' : 'Inactiva'}
          </Badge>
          {userCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="h-3 w-3" />
              <span>{userCount} {userCount === 1 ? 'usuario' : 'usuarios'}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

