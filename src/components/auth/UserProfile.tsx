'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle, LogOut, Settings } from 'lucide-react';

export default function UserProfile() {
  const { userProfile, signOut, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen(prevState => !prevState);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setMenuOpen(false);
  }, [signOut]);

  // Memoize role display to prevent unnecessary re-renders
  const getRoleDisplay = useMemo(() => {
    if (!userProfile) return '';
    switch (userProfile.role) {
      case 'SALES_AGENT':
        return 'Vendedor';
      case 'QUALITY_TEAM':
        return 'Equipo de Calidad';
      case 'PLANT_MANAGER':
        return 'Jefe de Planta';
      case 'EXECUTIVE':
        return 'Directivo';
      default:
        return userProfile.role;
    }
  }, [userProfile]);

  // Memoize display name to prevent unnecessary re-renders
  const displayName = useMemo(() => {
    if (!userProfile) return '';
    return userProfile.first_name || userProfile.email.split('@')[0];
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <div className="animate-pulse bg-gray-200 rounded-full h-8 w-8"></div>
        <div className="animate-pulse bg-gray-200 rounded h-4 w-20"></div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <UserCircle className="h-8 w-8 text-gray-700" />
        <span className="text-sm font-medium text-gray-800 hidden sm:inline-block">
          {displayName}
        </span>
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu"
        >
          <div className="py-3 px-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">
              {userProfile.first_name} {userProfile.last_name}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {userProfile.email}
            </p>
            <p className="text-xs font-medium text-indigo-600 mt-1">
              {getRoleDisplay}
            </p>
          </div>

          <div className="py-1" role="none">
            <a
              href="/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              role="menuitem"
            >
              <Settings className="mr-3 h-4 w-4 text-gray-400" />
              Mi Perfil
            </a>

            {userProfile.role === 'EXECUTIVE' && (
              <a
                href="/admin/users"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
              >
                <UserCircle className="mr-3 h-4 w-4 text-gray-400" />
                Gestionar Usuarios
              </a>
            )}

            <button
              onClick={handleSignOut}
              className="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
              role="menuitem"
            >
              <LogOut className="mr-3 h-4 w-4 text-red-400" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 