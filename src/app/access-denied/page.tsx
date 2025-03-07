'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AccessDeniedPage() {
  const { isAuthenticated, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md text-center">
        <div className="text-red-600 text-6xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
        
        <p className="text-gray-600 mb-6">
          No tienes permisos para acceder a esta sección. Si crees que esto es un error, contacta al administrador del sistema.
        </p>
        
        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="block w-full py-2 px-4 border border-transparent rounded-md 
                    shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Ir al Panel Principal
          </Link>
          
          {isAuthenticated && (
            <button
              onClick={signOut}
              className="block w-full py-2 px-4 border border-gray-300 rounded-md 
                        shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 