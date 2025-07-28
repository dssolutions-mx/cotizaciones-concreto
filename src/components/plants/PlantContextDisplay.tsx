'use client';

import React from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import EnhancedPlantSelector from './EnhancedPlantSelector';
import PlantAssignmentDisplay from './PlantAssignmentDisplay';

interface PlantContextDisplayProps {
  className?: string;
  showLabel?: boolean;
}

export default function PlantContextDisplay({ className = '', showLabel = false }: PlantContextDisplayProps) {
  const { isGlobalAdmin, userAccess, isLoading } = usePlantContext();

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  // Global admins get the full selector to switch between plants
  if (isGlobalAdmin) {
    return (
      <EnhancedPlantSelector 
        mode="VIEW" 
        className={className} 
        showLabel={showLabel} 
      />
    );
  }

  // Business unit users get the full selector to switch between plants in their BU
  if (userAccess?.accessLevel === 'BUSINESS_UNIT') {
    return (
      <EnhancedPlantSelector 
        mode="VIEW" 
        className={className} 
        showLabel={showLabel} 
      />
    );
  }

  // Plant users and unassigned users get the read-only display
  return (
    <PlantAssignmentDisplay 
      compact={true} 
      showDetails={false}
      className={className}
    />
  );
} 