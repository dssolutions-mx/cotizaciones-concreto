'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthStatusIndicator() {
  const { 
    authStatus,
    sessionExpiresAt,
    timeToExpiration,
    isSessionLoading,
    lastSessionRefresh,
    refreshSession
  } = useAuth();
  
  const [showDetails, setShowDetails] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  
  // Format timeToExpiration as a countdown
  useEffect(() => {
    if (!timeToExpiration) {
      setCountdown('');
      return;
    }
    
    const updateCountdown = () => {
      if (!sessionExpiresAt) return;
      
      const now = new Date();
      const diffMs = Math.max(0, sessionExpiresAt.getTime() - now.getTime());
      
      if (diffMs <= 0) {
        setCountdown('Expirado');
        return;
      }
      
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      
      if (diffHours > 0) {
        setCountdown(`${diffHours}h ${remainingMinutes}m`);
      } else {
        setCountdown(`${remainingMinutes}m`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [sessionExpiresAt, timeToExpiration]);
  
  // Early exit if not authenticated
  if (authStatus !== 'authenticated') return null;
  
  // Determine indicator color based on time remaining
  let indicatorColor = 'bg-green-500';
  let statusText = 'Sesión activa';
  
  if (timeToExpiration !== null) {
    if (timeToExpiration < 300000) { // Less than 5 minutes
      indicatorColor = 'bg-red-500';
      statusText = 'Sesión por expirar';
    } else if (timeToExpiration < 900000) { // Less than 15 minutes
      indicatorColor = 'bg-yellow-500';
      statusText = 'Sesión expirando pronto';
    }
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className="flex items-center bg-white rounded-lg shadow-md px-3 py-2 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className={`w-3 h-3 rounded-full ${indicatorColor} mr-2`}></div>
        <span className="text-sm font-medium text-gray-700">{statusText}</span>
        {countdown && (
          <span className="text-xs text-gray-500 ml-2">({countdown})</span>
        )}
      </div>
      
      {showDetails && (
        <div className="mt-2 p-4 bg-white rounded-lg shadow-lg w-80">
          <h3 className="text-sm font-semibold mb-2">Información de sesión</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Estado:</span>
              <span className="font-medium">
                {authStatus === 'authenticated' ? 'Autenticado' : 
                 authStatus === 'unauthenticated' ? 'No autenticado' : 'Cargando'}
              </span>
            </div>
            
            {sessionExpiresAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Expira:</span>
                <span className="font-medium">
                  {sessionExpiresAt.toLocaleTimeString()}
                </span>
              </div>
            )}
            
            {lastSessionRefresh && (
              <div className="flex justify-between">
                <span className="text-gray-500">Última actualización:</span>
                <span className="font-medium">
                  {lastSessionRefresh.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-3 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                refreshSession();
              }}
              disabled={isSessionLoading}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50"
            >
              {isSessionLoading ? 'Actualizando...' : 'Actualizar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 