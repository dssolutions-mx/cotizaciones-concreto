/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useEffect } from 'react';

/**
 * Versión optimizada que solo limpia los atributos necesarios una vez
 * y utiliza MutationObserver para ser más eficiente
 */
export default function AttributeCleaner() {
  useEffect(() => {
    // Solo ejecutar una vez al inicio
    const cleanup = () => {
      try {
        document.body.removeAttribute('data-new-gr-c-s-check-loaded');
        document.body.removeAttribute('data-gr-ext-installed');
      } catch (_e) {
        // Silenciar errores para evitar problemas
      }
    };
    
    // Ejecutar inmediatamente
    cleanup();
    
    // No configuramos MutationObserver ni otros observadores para
    // evitar sobrecarga de rendimiento
    
    return () => {};
  }, []);
  
  // Este componente no renderiza nada visible
  return null;
} 