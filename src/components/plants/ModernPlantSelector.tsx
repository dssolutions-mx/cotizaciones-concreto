'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, MapPin, Check } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ModernPlantSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export default function ModernPlantSelector({
  className = '',
  showLabel = false
}: ModernPlantSelectorProps) {
  const {
    currentPlant,
    availablePlants,
    businessUnits,
    userAccess,
    isGlobalAdmin,
    switchPlant,
    switchBusinessUnit,
    isLoading
  } = usePlantContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isBusinessUnitOpen, setIsBusinessUnitOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (buDropdownRef.current && !buDropdownRef.current.contains(event.target as Node)) {
        setIsBusinessUnitOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAccessibleBusinessUnits = () => {
    if (isGlobalAdmin) return businessUnits;
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
      return currentPlant?.business_unit_id
        ? availablePlants.filter(p => p.business_unit_id === currentPlant.business_unit_id)
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
  const selectedBusinessUnit = businessUnits.find(bu => bu.id === currentPlant?.business_unit_id);

  const handleBusinessUnitSelect = (businessUnitId: string) => {
    if (switchBusinessUnit) {
      switchBusinessUnit(businessUnitId);
    } else {
      const plantsInBU = availablePlants.filter(p => p.business_unit_id === businessUnitId);
      if (plantsInBU.length > 0) {
        switchPlant(plantsInBU[0].id);
      }
    }
    setIsBusinessUnitOpen(false);
  };

  const handlePlantSelect = (plantId: string) => {
    switchPlant(plantId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn("glass-thick rounded-2xl h-10 animate-pulse", className)} />
    );
  }

  // Plant-only users see read-only display
  if (userAccess?.accessLevel === 'PLANT') {
    return (
      <div className={cn("glass-thick rounded-2xl px-4 py-2 border border-label-tertiary/10", className)}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-systemBlue" />
          <span className="text-callout font-medium text-label-primary">
            {currentPlant?.name || 'Sin planta'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Business Unit Selector - Only for global admins */}
      {isGlobalAdmin && (
        <div ref={buDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsBusinessUnitOpen(!isBusinessUnitOpen)}
            className="glass-thick rounded-2xl px-4 py-2 border border-label-tertiary/10 hover:border-systemBlue/30 transition-all duration-200 flex items-center gap-2 min-w-[180px]"
          >
            <Building2 className="h-4 w-4 text-systemBlue" />
            <span className="text-callout font-medium text-label-primary flex-1 text-left">
              {selectedBusinessUnit?.name || 'Todas las unidades'}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-label-tertiary transition-transform duration-200",
                isBusinessUnitOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {isBusinessUnitOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1.0] }}
                className="absolute z-[100] mt-2 w-full min-w-[280px] glass-thick rounded-2xl border border-label-tertiary/10 shadow-2xl overflow-hidden"
              >
                <div className="max-h-[400px] overflow-y-auto p-2">
                  {accessibleBusinessUnits.map((bu) => (
                    <button
                      key={bu.id}
                      type="button"
                      onClick={() => handleBusinessUnitSelect(bu.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl text-callout transition-all duration-150",
                        "hover:bg-systemBlue/10 flex items-center gap-3",
                        bu.id === selectedBusinessUnit?.id && "bg-systemBlue/10"
                      )}
                    >
                      <Building2 className="h-4 w-4 text-systemBlue flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-label-primary">{bu.name}</div>
                        <div className="text-caption text-label-tertiary">{bu.code}</div>
                      </div>
                      {bu.id === selectedBusinessUnit?.id && (
                        <Check className="h-4 w-4 text-systemBlue flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Plant Selector */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={accessiblePlants.length === 0}
          className="glass-thick rounded-2xl px-4 py-2 border border-label-tertiary/10 hover:border-systemBlue/30 transition-all duration-200 flex items-center gap-2 min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MapPin className="h-4 w-4 text-systemBlue" />
          <span className="text-callout font-medium text-label-primary flex-1 text-left">
            {currentPlant ? currentPlant.name : 'Seleccionar planta'}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-label-tertiary transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {isOpen && accessiblePlants.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="absolute z-[100] mt-2 w-full min-w-[320px] glass-thick rounded-2xl border border-label-tertiary/10 shadow-2xl overflow-hidden"
            >
              <div className="max-h-[400px] overflow-y-auto p-2">
                {accessiblePlants.map((plant) => (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() => handlePlantSelect(plant.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-callout transition-all duration-150",
                      "hover:bg-systemBlue/10 flex items-center gap-3",
                      plant.id === currentPlant?.id && "bg-systemBlue/10"
                    )}
                  >
                    <MapPin className="h-4 w-4 text-systemBlue flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-label-primary">{plant.name}</div>
                      <div className="text-caption text-label-tertiary">
                        {plant.code}
                        {plant.location && ` • ${plant.location}`}
                      </div>
                    </div>
                    {plant.id === currentPlant?.id && (
                      <Check className="h-4 w-4 text-systemBlue flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
