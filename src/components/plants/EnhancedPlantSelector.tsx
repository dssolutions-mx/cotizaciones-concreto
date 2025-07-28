'use client';

import React, { useState } from 'react';
import { ChevronDown, Building2, MapPin, AlertCircle } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { cn } from '@/lib/utils';

interface EnhancedPlantSelectorProps {
  mode: 'VIEW' | 'CREATE'; // VIEW for switching context, CREATE for selecting plant for new data
  selectedPlantId?: string | null;
  selectedBusinessUnitId?: string | null;
  onPlantChange?: (plantId: string | null) => void;
  onBusinessUnitChange?: (businessUnitId: string | null) => void;
  className?: string;
  showLabel?: boolean;
  required?: boolean;
}

export default function EnhancedPlantSelector({ 
  mode,
  selectedPlantId,
  selectedBusinessUnitId,
  onPlantChange,
  onBusinessUnitChange,
  className, 
  showLabel = true,
  required = false
}: EnhancedPlantSelectorProps) {
  const { 
    currentPlant, 
    availablePlants, 
    businessUnits,
    userAccess, 
    isGlobalAdmin, 
    switchPlant,
    isLoading 
  } = usePlantContext();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isBusinessUnitOpen, setIsBusinessUnitOpen] = useState(false);

  // For VIEW mode, use context values; for CREATE mode, use props
  const activePlantId = mode === 'VIEW' ? currentPlant?.id : selectedPlantId;
  const activeBusinessUnitId = mode === 'VIEW' 
    ? currentPlant?.business_unit_id 
    : selectedBusinessUnitId;

  // Determine user's access level and available options
  const getAccessibleBusinessUnits = () => {
    if (isGlobalAdmin) {
      return businessUnits;
    }
    if (userAccess?.accessLevel === 'BUSINESS_UNIT') {
      return businessUnits.filter(bu => bu.id === userAccess.businessUnitId);
    }
    if (userAccess?.accessLevel === 'PLANT') {
      const plantBU = availablePlants.find(p => p.id === userAccess.plantId)?.business_unit_id;
      return businessUnits.filter(bu => bu.id === plantBU);
    }
    return [];
  };

  const getAccessiblePlants = () => {
    if (isGlobalAdmin) {
      // Filter by selected business unit if any
      return activeBusinessUnitId 
        ? availablePlants.filter(p => p.business_unit_id === activeBusinessUnitId)
        : availablePlants;
    }
    if (userAccess?.accessLevel === 'BUSINESS_UNIT') {
      return availablePlants.filter(p => p.business_unit_id === userAccess.businessUnitId);
    }
    if (userAccess?.accessLevel === 'PLANT') {
      return availablePlants.filter(p => p.id === userAccess.plantId);
    }
    return [];
  };

  const accessibleBusinessUnits = getAccessibleBusinessUnits();
  const accessiblePlants = getAccessiblePlants();

  const selectedBusinessUnit = businessUnits.find(bu => bu.id === activeBusinessUnitId);
  const selectedPlant = availablePlants.find(p => p.id === activePlantId);

  const handleBusinessUnitSelect = (businessUnitId: string) => {
    if (mode === 'VIEW') {
      // For view mode, we need to switch to a plant in this business unit
      const plantsInBU = availablePlants.filter(p => p.business_unit_id === businessUnitId);
      if (plantsInBU.length > 0) {
        switchPlant(plantsInBU[0].id);
      }
    } else {
      // For create mode, call the callback
      onBusinessUnitChange?.(businessUnitId);
      // Clear plant selection if it's not in the new business unit
      if (selectedPlantId) {
        const plant = availablePlants.find(p => p.id === selectedPlantId);
        if (plant?.business_unit_id !== businessUnitId) {
          onPlantChange?.(null);
        }
      }
    }
    setIsBusinessUnitOpen(false);
  };

  const handlePlantSelect = (plantId: string) => {
    if (mode === 'VIEW') {
      switchPlant(plantId);
    } else {
      onPlantChange?.(plantId);
      // Auto-select business unit if not already selected
      const plant = availablePlants.find(p => p.id === plantId);
      if (plant && !activeBusinessUnitId) {
        onBusinessUnitChange?.(plant.business_unit_id);
      }
    }
    setIsOpen(false);
  };

  // Don't show for PLANT users in VIEW mode (they can't switch)
  if (mode === 'VIEW' && userAccess?.accessLevel === 'PLANT') {
    return showLabel ? (
      <div className={cn("flex items-center gap-2 text-sm text-gray-600", className)}>
        <Building2 className="h-4 w-4" />
        <span>{selectedPlant?.name || 'Planta No Asignada'}</span>
      </div>
    ) : null;
  }

  // For CREATE mode, show appropriate selectors based on user access
  if (mode === 'CREATE') {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Business Unit Selector */}
        {(isGlobalAdmin || userAccess?.accessLevel === 'BUSINESS_UNIT') && (
          <div className="space-y-1">
            {showLabel && (
              <label className="text-sm font-medium text-gray-700">
                Unidad de Negocio {required && <span className="text-red-500">*</span>}
              </label>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBusinessUnitOpen(!isBusinessUnitOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className={selectedBusinessUnit ? "text-gray-900" : "text-gray-500"}>
                    {selectedBusinessUnit?.name || "Seleccionar unidad de negocio"}
                  </span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", {
                  "transform rotate-180": isBusinessUnitOpen
                })} />
              </button>

              {isBusinessUnitOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                  <div className="py-1 max-h-60 overflow-auto">
                    {accessibleBusinessUnits.map((bu) => (
                      <button
                        key={bu.id}
                        type="button"
                        onClick={() => handleBusinessUnitSelect(bu.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{bu.name}</div>
                          <div className="text-xs text-gray-500">{bu.code}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plant Selector */}
        <div className="space-y-1">
          {showLabel && (
            <label className="text-sm font-medium text-gray-700">
              Planta {required && <span className="text-red-500">*</span>}
            </label>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              disabled={accessiblePlants.length === 0}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className={selectedPlant ? "text-gray-900" : "text-gray-500"}>
                  {selectedPlant ? (
                    <div>
                      <span className="font-medium">{selectedPlant.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({selectedPlant.code})</span>
                    </div>
                  ) : accessiblePlants.length === 0 ? (
                    "No hay plantas disponibles"
                  ) : (
                    "Seleccionar planta"
                  )}
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", {
                "transform rotate-180": isOpen
              })} />
            </button>

            {isOpen && accessiblePlants.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                <div className="py-1 max-h-60 overflow-auto">
                  {accessiblePlants.map((plant) => (
                    <button
                      key={plant.id}
                      type="button"
                      onClick={() => handlePlantSelect(plant.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium">{plant.name}</div>
                        <div className="text-xs text-gray-500">{plant.code}</div>
                        {plant.location && (
                          <div className="text-xs text-gray-400">{plant.location}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warning for unassigned users */}
        {accessiblePlants.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              No tienes acceso a ninguna planta. Contacta al administrador.
            </span>
          </div>
        )}
      </div>
    );
  }

  // VIEW mode for GLOBAL and BUSINESS_UNIT users
  return (
    <div className={cn("space-y-2", className)}>
      {/* Business Unit Display/Selector */}
      {isGlobalAdmin && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBusinessUnitOpen(!isBusinessUnitOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Building2 className="h-4 w-4 text-gray-600" />
            <span className="font-medium">
              {selectedBusinessUnit?.name || 'Seleccionar Unidad'}
            </span>
            <ChevronDown className={cn("h-3 w-3 text-gray-400 transition-transform", {
              "transform rotate-180": isBusinessUnitOpen
            })} />
          </button>

          {isBusinessUnitOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-gray-300 rounded-md shadow-lg">
              <div className="py-1 max-h-60 overflow-auto">
                {accessibleBusinessUnits.map((bu) => (
                  <button
                    key={bu.id}
                    type="button"
                    onClick={() => handleBusinessUnitSelect(bu.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium">{bu.name}</div>
                      <div className="text-xs text-gray-500">{bu.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plant Display/Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
        >
          <MapPin className="h-4 w-4 text-gray-600" />
          <span className="font-medium">
            {selectedPlant ? selectedPlant.name : 'Seleccionar Planta'}
          </span>
          <ChevronDown className={cn("h-3 w-3 text-gray-400 transition-transform", {
            "transform rotate-180": isOpen
          })} />
        </button>

        {isOpen && accessiblePlants.length > 0 && (
          <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="py-1 max-h-60 overflow-auto">
              {accessiblePlants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => handlePlantSelect(plant.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">{plant.name}</div>
                    <div className="text-xs text-gray-500">{plant.code}</div>
                    {plant.location && (
                      <div className="text-xs text-gray-400">{plant.location}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 