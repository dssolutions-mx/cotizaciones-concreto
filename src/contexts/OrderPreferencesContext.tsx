'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OrderStatus, CreditStatus } from '@/types/orders';

type ViewType = 'day' | 'week' | 'month';
type OrderTab = 'list' | 'create' | 'credit' | 'rejected' | 'calendar';

interface OrderPreferences {
  activeTab: OrderTab;
  calendarViewType: ViewType;
  calendarDate: string;
  statusFilter?: string;
  creditStatusFilter?: string;
  lastScrollPosition?: number;
}

interface OrderPreferencesContextType {
  preferences: OrderPreferences;
  updatePreferences: (newPrefs: Partial<OrderPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: OrderPreferences = {
  activeTab: 'list',
  calendarViewType: 'week',
  calendarDate: new Date().toISOString(),
  statusFilter: undefined,
  creditStatusFilter: undefined,
  lastScrollPosition: 0
};

const OrderPreferencesContext = createContext<OrderPreferencesContextType | undefined>(undefined);

export function OrderPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<OrderPreferences>(defaultPreferences);
  
  // Cargar preferencias guardadas al iniciar
  useEffect(() => {
    const savedPrefs = localStorage.getItem('orderPreferences');
    if (savedPrefs) {
      try {
        const parsedPrefs = JSON.parse(savedPrefs);
        setPreferences(parsedPrefs);
      } catch (error) {
        console.error('Error al cargar preferencias de órdenes:', error);
        localStorage.removeItem('orderPreferences');
      }
    }
  }, []);
  
  // Guardar preferencias al cambiar
  useEffect(() => {
    localStorage.setItem('orderPreferences', JSON.stringify(preferences));
  }, [preferences]);
  
  const updatePreferences = (newPrefs: Partial<OrderPreferences>) => {
    setPreferences(prev => {
      // Check if any values are actually changing
      const hasChanges = Object.entries(newPrefs).some(
        ([key, value]) => prev[key as keyof OrderPreferences] !== value
      );
      
      // Only update state if there are changes
      if (hasChanges) {
        return { ...prev, ...newPrefs };
      }
      return prev;
    });
  };
  
  const resetPreferences = () => {
    localStorage.removeItem('orderPreferences');
    setPreferences(defaultPreferences);
  };
  
  return (
    <OrderPreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
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