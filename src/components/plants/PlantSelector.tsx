'use client';

import React, { useState } from 'react';
import { ChevronDown, Building2, MapPin } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { cn } from '@/lib/utils';

interface PlantSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export default function PlantSelector({ className, showLabel = true }: PlantSelectorProps) {
  const { 
    currentPlant, 
    availablePlants, 
    userAccess, 
    isGlobalAdmin, 
    switchPlant,
    isLoading 
  } = usePlantContext();
  
  const [isOpen, setIsOpen] = useState(false);

  // Don't show selector if user doesn't have permission to switch
  if (!isGlobalAdmin && userAccess?.accessLevel !== 'BUSINESS_UNIT') {
    return null;
  }

  // Filter plants based on user access
  const accessiblePlants = isGlobalAdmin 
    ? availablePlants 
    : availablePlants.filter(plant => 
        plant.business_unit_id === userAccess?.businessUnitId
      );

  if (isLoading || accessiblePlants.length <= 1) {
    return null;
  }

  const handlePlantSelect = (plantId: string) => {
    switchPlant(plantId);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      {showLabel && (
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Planta Actual
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50"
        >
          <div className="flex items-center">
            <Building2 className="h-4 w-4 text-gray-400 mr-2" />
            <div className="flex-1 min-w-0">
              <span className="block truncate font-medium text-gray-900">
                {currentPlant?.name || 'Seleccionar Planta'}
              </span>
              {currentPlant?.location && (
                <span className="block truncate text-xs text-gray-500 flex items-center mt-0.5">
                  <MapPin className="h-3 w-3 mr-1" />
                  {currentPlant.location}
                </span>
              )}
            </div>
          </div>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDown 
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          </span>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute z-20 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
              {accessiblePlants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => handlePlantSelect(plant.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                    currentPlant?.id === plant.id && "bg-green-50 text-green-900"
                  )}
                >
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="block truncate font-medium">
                          {plant.name}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-2">
                          {plant.code}
                        </span>
                      </div>
                      {plant.location && (
                        <span className="block truncate text-xs text-gray-500 flex items-center mt-0.5">
                          <MapPin className="h-3 w-3 mr-1" />
                          {plant.location}
                        </span>
                      )}
                      {plant.business_unit && (
                        <span className="block truncate text-xs text-blue-600 mt-0.5">
                          {plant.business_unit.name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 