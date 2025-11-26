'use client';

import React from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { Building2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface PlantSelectorProps {
  selectedPlantId: string | null;
  selectedBusinessUnitId: string | null;
  onPlantChange: (plantId: string | null) => void;
  onBusinessUnitChange: (businessUnitId: string | null) => void;
}

export function PlantSelector({
  selectedPlantId,
  selectedBusinessUnitId,
  onPlantChange,
  onBusinessUnitChange,
}: PlantSelectorProps) {
  const { availablePlants, businessUnits } = usePlantContext();

  return (
    <div className="space-y-6">
      {/* Business Units */}
      {businessUnits && businessUnits.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Unidades de Negocio</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onBusinessUnitChange(null)}
              className={`glass-interactive rounded-lg p-4 text-left border transition-all ${
                selectedBusinessUnitId === null
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className={`h-5 w-5 ${
                  selectedBusinessUnitId === null ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <div>
                  <p className="font-medium text-gray-900">Ninguna</p>
                  <p className="text-sm text-gray-500">Sin asignación</p>
                </div>
              </div>
            </motion.button>
            
            {businessUnits.map((bu) => (
              <motion.button
                key={bu.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onBusinessUnitChange(bu.id)}
                className={`glass-interactive rounded-lg p-4 text-left border transition-all ${
                  selectedBusinessUnitId === bu.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className={`h-5 w-5 ${
                    selectedBusinessUnitId === bu.id ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{bu.name}</p>
                    <p className="text-sm text-gray-500">{bu.code}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Plants */}
      {availablePlants && availablePlants.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Plantas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPlantChange(null)}
              className={`glass-interactive rounded-lg p-4 text-left border transition-all ${
                selectedPlantId === null && selectedBusinessUnitId === null
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className={`h-5 w-5 ${
                  selectedPlantId === null && selectedBusinessUnitId === null ? 'text-green-600' : 'text-gray-400'
                }`} />
                <div>
                  <p className="font-medium text-gray-900">Ninguna</p>
                  <p className="text-sm text-gray-500">Sin asignación</p>
                </div>
              </div>
            </motion.button>
            
            {availablePlants.map((plant) => (
              <motion.button
                key={plant.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPlantChange(plant.id)}
                className={`glass-interactive rounded-lg p-4 text-left border transition-all ${
                  selectedPlantId === plant.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className={`h-5 w-5 ${
                    selectedPlantId === plant.id ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{plant.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-500">{plant.code}</p>
                      {plant.location && (
                        <>
                          <span className="text-gray-300">•</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <p className="text-sm text-gray-500">{plant.location}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

