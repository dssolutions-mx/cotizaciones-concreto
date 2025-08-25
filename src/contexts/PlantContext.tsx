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

  // Check if user is global admin (EXECUTIVE or CREDIT_VALIDATOR with no plant/BU assignment)
  const isGlobalAdmin = (profile?.role === 'EXECUTIVE' || profile?.role === 'CREDIT_VALIDATOR') && !profile.plant_id && !profile.business_unit_id;

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

      // Set current plant (without localStorage to prevent hydration mismatch)
      if (isGlobalAdmin) {
        // Global admin can see all plants, but prioritize plants with data
        // First try to find a plant with recipes/remisiones, otherwise use first non-DIACE plant
        let defaultPlant = plantsData?.[0];
        
        // Try to find a plant with recipes first
        const plantsWithData = plantsData?.filter(p => p.code !== 'DIACE');
        if (plantsWithData && plantsWithData.length > 0) {
          defaultPlant = plantsWithData[0];
        }
        
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

  // Switch business unit (only for global admins)
  const switchBusinessUnit = useCallback((businessUnitId: string) => {
    if (!isGlobalAdmin) {
      console.warn('User does not have permission to switch business units');
      return;
    }

    // Find first plant in the selected business unit
    const plantInBU = availablePlants.find(p => p.business_unit_id === businessUnitId);
    if (plantInBU) {
      setCurrentPlant(plantInBU);
      localStorage.setItem('selectedPlantId', plantInBU.id);
      localStorage.setItem('selectedBusinessUnitId', businessUnitId);
    }
  }, [isGlobalAdmin, availablePlants]);

  // Handle localStorage access after component mounts to prevent hydration mismatch
  useEffect(() => {
    if (isGlobalAdmin && availablePlants.length > 0 && !currentPlant) {
      const storedPlantId = localStorage.getItem('selectedPlantId');
      const storedBusinessUnitId = localStorage.getItem('selectedBusinessUnitId');
      
      if (storedPlantId) {
        const storedPlant = availablePlants.find(p => p.id === storedPlantId);
        // Don't restore DIACE plant as it has no data
        if (storedPlant && storedPlant.code !== 'DIACE') {
          setCurrentPlant(storedPlant);
        } else if (storedPlant?.code === 'DIACE') {
          // Clear the stored DIACE plant ID and find a better default
          localStorage.removeItem('selectedPlantId');
          const betterPlant = availablePlants.find(p => p.code !== 'DIACE');
          if (betterPlant) {
            setCurrentPlant(betterPlant);
          }
        }
      } else if (storedBusinessUnitId) {
        // If no plant stored but business unit is, find first plant in that BU
        const plantInBU = availablePlants.find(p => p.business_unit_id === storedBusinessUnitId);
        if (plantInBU && plantInBU.code !== 'DIACE') {
          setCurrentPlant(plantInBU);
        }
      }
    }
  }, [isGlobalAdmin, availablePlants, currentPlant]);

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
    switchBusinessUnit,
    refreshPlantData,
    isLoading
  };

  return (
    <PlantContext.Provider value={contextValue}>
      {children}
    </PlantContext.Provider>
  );
}; 