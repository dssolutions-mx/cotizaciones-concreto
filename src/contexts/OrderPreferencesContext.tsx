'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { OrderStatus, CreditStatus } from '@/types/orders';

type ViewType = 'day' | 'week' | 'month';
type OrderTab = 'list' | 'create' | 'credit' | 'rejected' | 'calendar';

// Separar las preferencias en preferencias persistentes (localStorage) y temporales (sessionStorage)
interface OrderPreferences {
  // Preferencias persistentes (guardadas en localStorage)
  activeTab: OrderTab;
  calendarViewType: ViewType;
  calendarDate: string;
  
  // Preferencias temporales (guardadas en sessionStorage)
  statusFilter?: string;
  creditStatusFilter?: string;
  lastScrollPosition?: number;
  temporaryState?: Record<string, any>; // Para almacenar estado temporal adicional
}

interface OrderPreferencesContextType {
  preferences: OrderPreferences;
  updatePreferences: (newPrefs: Partial<OrderPreferences>) => void;
  resetPreferences: () => void;
  // Métodos específicos para estado temporal
  setTemporaryState: (key: string, value: any) => void;
  getTemporaryState: (key: string) => any;
}

const defaultPreferences: OrderPreferences = {
  activeTab: 'list',
  calendarViewType: 'week',
  calendarDate: new Date().toISOString(),
  statusFilter: undefined,
  creditStatusFilter: undefined,
  lastScrollPosition: 0,
  temporaryState: {}
};

// Claves para almacenamiento
const STORAGE_KEYS = {
  PERSISTENT: 'orderPreferences',
  TEMPORARY: 'orderTemporaryState'
};

const OrderPreferencesContext = createContext<OrderPreferencesContextType | undefined>(undefined);

export function OrderPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<OrderPreferences>(defaultPreferences);
  
  // Cargar preferencias persistentes (localStorage) al iniciar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Cargar preferencias persistentes
      const savedPrefs = localStorage.getItem(STORAGE_KEYS.PERSISTENT);
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        
        // Establecer preferencias persistentes
        setPreferences(prev => ({
          ...prev,
          activeTab: parsedPrefs.activeTab || prev.activeTab,
          calendarViewType: parsedPrefs.calendarViewType || prev.calendarViewType,
          calendarDate: parsedPrefs.calendarDate || prev.calendarDate
        }));
      }
      
      // Cargar preferencias temporales
      const tempState = sessionStorage.getItem(STORAGE_KEYS.TEMPORARY);
      if (tempState) {
        const parsedTemp = JSON.parse(tempState);
        
        // Establecer preferencias temporales
        setPreferences(prev => ({
          ...prev,
          statusFilter: parsedTemp.statusFilter || prev.statusFilter,
          creditStatusFilter: parsedTemp.creditStatusFilter || prev.creditStatusFilter,
          lastScrollPosition: parsedTemp.lastScrollPosition || prev.lastScrollPosition,
          temporaryState: parsedTemp.temporaryState || prev.temporaryState
        }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      // Clear potentially corrupted storage
      localStorage.removeItem(STORAGE_KEYS.PERSISTENT);
      sessionStorage.removeItem(STORAGE_KEYS.TEMPORARY);
    }
  }, []);
  
  // Guardar preferencias al cambiar - use a debounced effect to avoid excessive writes
  const savePreferencesRef = React.useRef(preferences);
  
  useEffect(() => {
    savePreferencesRef.current = preferences;
  }, [preferences]);
  
  // Use a separate effect for storage updates to avoid loops
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saveToStorage = () => {
      try {
        const currentPrefs = savePreferencesRef.current;
        
        // Guardar preferencias persistentes (localStorage)
        const persistentPrefs = {
          activeTab: currentPrefs.activeTab,
          calendarViewType: currentPrefs.calendarViewType,
          calendarDate: currentPrefs.calendarDate
        };
        localStorage.setItem(STORAGE_KEYS.PERSISTENT, JSON.stringify(persistentPrefs));
        
        // Guardar estado temporal (sessionStorage)
        const temporaryPrefs = {
          statusFilter: currentPrefs.statusFilter,
          creditStatusFilter: currentPrefs.creditStatusFilter,
          lastScrollPosition: currentPrefs.lastScrollPosition,
          temporaryState: currentPrefs.temporaryState
        };
        sessionStorage.setItem(STORAGE_KEYS.TEMPORARY, JSON.stringify(temporaryPrefs));
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    };
    
    // Save immediately on first render
    saveToStorage();
    
    // Set up periodic saving to avoid excessive writes
    const interval = setInterval(saveToStorage, 1000);
    
    return () => {
      clearInterval(interval);
      // Save one last time when unmounting
      saveToStorage();
    };
  }, []);
  
  // Manejar eventos de visibilidad
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Al volver a la pestaña, recargar estado temporal
        try {
          const tempState = sessionStorage.getItem(STORAGE_KEYS.TEMPORARY);
          if (tempState) {
            const parsedTemp = JSON.parse(tempState);
            setPreferences(prev => {
              // Only update if values have actually changed
              if (
                prev.statusFilter === parsedTemp.statusFilter &&
                prev.creditStatusFilter === parsedTemp.creditStatusFilter &&
                prev.lastScrollPosition === parsedTemp.lastScrollPosition &&
                JSON.stringify(prev.temporaryState) === JSON.stringify(parsedTemp.temporaryState)
              ) {
                return prev; // No changes, return previous state
              }
              
              return {
                ...prev,
                statusFilter: parsedTemp.statusFilter || prev.statusFilter,
                creditStatusFilter: parsedTemp.creditStatusFilter || prev.creditStatusFilter,
                lastScrollPosition: parsedTemp.lastScrollPosition || prev.lastScrollPosition,
                temporaryState: parsedTemp.temporaryState || prev.temporaryState
              };
            });
          }
        } catch (error) {
          console.error('Error loading preferences during visibility change:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Use stable identity for functions to prevent unnecessary re-renders
  const updatePreferences = useCallback((newPrefs: Partial<OrderPreferences>) => {
    setPreferences(prev => {
      // Check if any values are actually changing
      const hasChanges = Object.entries(newPrefs).some(
        ([key, value]) => {
          const prevValue = prev[key as keyof OrderPreferences];
          
          // Skip if both are undefined or null
          if (value == null && prevValue == null) {
            return false;
          }
          
          // Special handling for objects and arrays
          if (typeof value === 'object' && value !== null && typeof prevValue === 'object' && prevValue !== null) {
            try {
              // Simple shallow comparison for objects
              if (Array.isArray(value) && Array.isArray(prevValue)) {
                // Compare arrays
                return JSON.stringify(value) !== JSON.stringify(prevValue);
              } else {
                // Compare objects
                return JSON.stringify(value) !== JSON.stringify(prevValue);
              }
            } catch (error) {
              console.error('Error comparing objects:', error);
              return true; // Assume change on error
            }
          }
          
          // Simple value comparison for primitives
          return prevValue !== value;
        }
      );
      
      // Only update state if there are changes
      if (hasChanges) {
        return { ...prev, ...newPrefs };
      }
      return prev;
    });
  }, []);
  
  const setTemporaryState = useCallback((key: string, value: any) => {
    setPreferences(prev => {
      // Check if the value has actually changed
      const currentValue = prev.temporaryState?.[key];
      
      // Skip update if values are the same (prevents infinite loops)
      if (JSON.stringify(currentValue) === JSON.stringify(value)) {
        return prev;
      }
      
      const newTempState = { 
        ...prev.temporaryState,
        [key]: value 
      };
      
      return {
        ...prev,
        temporaryState: newTempState
      };
    });
  }, []);
  
  const getTemporaryState = useCallback((key: string) => {
    return preferences.temporaryState?.[key];
  }, [preferences.temporaryState]);
  
  const resetPreferences = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.PERSISTENT);
    sessionStorage.removeItem(STORAGE_KEYS.TEMPORARY);
    setPreferences(defaultPreferences);
  }, []);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    preferences,
    updatePreferences,
    resetPreferences,
    setTemporaryState,
    getTemporaryState
  }), [
    preferences,
    updatePreferences,
    resetPreferences,
    setTemporaryState,
    getTemporaryState
  ]);
  
  return (
    <OrderPreferencesContext.Provider value={contextValue}>
      {children}
    </OrderPreferencesContext.Provider>
  );
}

export function useOrderPreferences() {
  const context = useContext(OrderPreferencesContext);
  if (context === undefined) {
    throw new Error('useOrderPreferences debe usarse dentro de un OrderPreferencesProvider');
  }
  return context;
} 