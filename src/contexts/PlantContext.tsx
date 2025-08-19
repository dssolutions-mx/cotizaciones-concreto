'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase/client';
import type { Plant, BusinessUnit, UserPlantAccess, PlantContextType } from '@/types/plant';

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export const usePlantContext = () => {
  const context = useContext(PlantContext);
  if (context === undefined) {
    throw new Error('usePlantContext must be used within a PlantProvider');
  }
  return context;
};

interface PlantProviderProps {
  children: ReactNode;
}

export const PlantProvider: React.FC<PlantProviderProps> = ({ children }) => {
  const { profile, session } = useAuthBridge();
  const [currentPlant, setCurrentPlant] = useState<Plant | null>(null);
  const [availablePlants, setAvailablePlants] = useState<Plant[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [userAccess, setUserAccess] = useState<UserPlantAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is global admin (EXECUTIVE with no plant assignment)
  const isGlobalAdmin = profile?.role === 'EXECUTIVE' && !profile.plant_id && !profile.business_unit_id;

  // Fetch plant and business unit data
  const refreshPlantData = useCallback(async () => {
    if (!session || !profile) {
      // Don't reset plant data immediately, keep previous state if valid
      if (!currentPlant) {
        setIsLoading(false);
      }
      return;
    }

    try {
      setIsLoading(true);

      // Fetch business units
      const { data: businessUnitsData, error: buError } = await supabase
        .from('business_units')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (buError) throw buError;
      setBusinessUnits(businessUnitsData || []);

      // Fetch plants with business unit information
      const { data: plantsData, error: plantsError } = await supabase
        .from('plants')
        .select(`
          *,
          business_unit:business_units(*)
        `)
        .eq('is_active', true)
        .order('code');

      if (plantsError) throw plantsError;
      setAvailablePlants(plantsData || []);

      // Set user access based on profile
      const access: UserPlantAccess = {
        userId: profile.id,
        plantId: profile.plant_id || undefined,
        businessUnitId: profile.business_unit_id || undefined,
        accessLevel: isGlobalAdmin ? 'GLOBAL' : 
                    profile.business_unit_id ? 'BUSINESS_UNIT' : 'PLANT'
      };
      setUserAccess(access);

      // Set current plant
      if (isGlobalAdmin) {
        // Global admin can see all plants, default to first one or stored preference
        const storedPlantId = localStorage.getItem('selectedPlantId');
        const defaultPlant = storedPlantId 
          ? plantsData?.find(p => p.id === storedPlantId)
          : plantsData?.[0];
        setCurrentPlant(defaultPlant || null);
      } else if (profile.plant_id) {
        // User assigned to specific plant
        const userPlant = plantsData?.find(p => p.id === profile.plant_id);
        setCurrentPlant(userPlant || null);
      } else if (profile.business_unit_id) {
        // User assigned to business unit, default to first plant in that BU
        const buPlants = plantsData?.filter(p => p.business_unit_id === profile.business_unit_id);
        setCurrentPlant(buPlants?.[0] || null);
      }

    } catch (error) {
      console.error('Error fetching plant data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, profile, isGlobalAdmin]);

  // Switch plant (only for global admins or business unit managers)
  const switchPlant = useCallback((plantId: string) => {
    if (!isGlobalAdmin && userAccess?.accessLevel !== 'BUSINESS_UNIT') {
      console.warn('User does not have permission to switch plants');
      return;
    }

    const plant = availablePlants.find(p => p.id === plantId);
    if (plant) {
      // Check if user has access to this plant
      if (userAccess?.accessLevel === 'BUSINESS_UNIT' && 
          plant.business_unit_id !== userAccess.businessUnitId) {
        console.warn('User does not have access to this plant');
        return;
      }

      setCurrentPlant(plant);
      
      // Store preference for global admins
      if (isGlobalAdmin) {
        localStorage.setItem('selectedPlantId', plantId);
      }
    }
  }, [isGlobalAdmin, userAccess, availablePlants]);

  // Fetch data when auth state changes - but prevent unnecessary refreshes
  const lastProfileRef = React.useRef(profile);
  const lastSessionRef = React.useRef(session);
  
  useEffect(() => {
    // Only refresh if profile or session actually changed in a meaningful way
    const profileChanged = profile?.id !== lastProfileRef.current?.id || 
                          profile?.role !== lastProfileRef.current?.role ||
                          profile?.plant_id !== lastProfileRef.current?.plant_id ||
                          profile?.business_unit_id !== lastProfileRef.current?.business_unit_id;
    
    const sessionChanged = session?.user?.id !== lastSessionRef.current?.user?.id;
    
    if (profileChanged || sessionChanged) {
      lastProfileRef.current = profile;
      lastSessionRef.current = session;
      refreshPlantData();
    }
  }, [profile, session, refreshPlantData]);

  const contextValue: PlantContextType = {
    currentPlant,
    availablePlants,
    businessUnits,
    userAccess,
    isGlobalAdmin,
    switchPlant,
    refreshPlantData,
    isLoading
  };

  return (
    <PlantContext.Provider value={contextValue}>
      {children}
    </PlantContext.Provider>
  );
}; 