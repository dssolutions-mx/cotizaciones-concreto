'use client';

import { useEffect } from 'react';

/**
 * Versión optimizada del manejador de errores de hidratación
 * Solo se activa en desarrollo y solo intercepta errores específicos
 */
export function HydrationErrorHandler() {
  // Este componente solo se usará en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  // Solo montamos el efecto en desarrollo
  useEffect(() => {
    // No hacemos nada más aquí, ya que la consola incorporada
    // en el entorno de desarrollo ya proporciona buenos mensajes de error
    
    return () => {};
  }, []);

  return null;
}

/**
 * Versión simplificada del preservador de scroll
 * para evitar problemas de rendimiento
 */
export function ScrollPreserver() {
  // Desactivamos completamente este componente para mejorar el rendimiento
  // Si es necesario, se puede activar de forma condicional solo cuando sea necesario
  return null;
} 