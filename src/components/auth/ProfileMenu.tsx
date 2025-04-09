'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle, LogOut, Settings, UserCog } from 'lucide-react';
import Link from 'next/link';

export default function ProfileMenu() {
  const { userProfile, signOut, loading, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Memoize display name to prevent unnecessary re-renders
  const displayName = useMemo(() => {
    if (!userProfile) return '';
    if (userProfile.first_name) return userProfile.first_name;
    return userProfile.email.split('@')[0];
  }, [userProfile]);

  // Memoize role display to prevent unnecessary re-renders
  const roleDisplay = useMemo(() => {
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
      case 'CREDIT_VALIDATOR':
        return 'Validador de Crédito';
      case 'DOSIFICADOR':
        return 'Dosificador';
      default:
        return userProfile.role;
    }
  }, [userProfile]);

  // Cerrar el menú cuando se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setMenuOpen(false);
      // Use setTimeout to prevent navigation during render
      setTimeout(() => {
        router.push('/login');
      }, 0);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }, [signOut, router]);

  if (loading) {
    return (
      <div className="flex items-center">
        <div className="animate-pulse w-8 h-8 rounded-full bg-gray-200"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link 
        href="/login" 
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
      >
        <UserCircle className="w-5 h-5" />
        <span>Iniciar Sesión</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(prevState => !prevState)}
        className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-2 transition-colors"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
          <UserCircle className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-gray-700 hidden md:block">
          {displayName}
        </span>
      </button>

      {menuOpen && userProfile && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="font-medium text-gray-800">{userProfile.first_name} {userProfile.last_name}</div>
            <div className="text-sm text-gray-500 truncate">{userProfile.email}</div>
            <div className="text-xs font-medium text-indigo-600 mt-1">
              {roleDisplay}
            </div>
          </div>
          
          <div className="py-1">
            <Link 
              href="/profile" 
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="mr-3 h-4 w-4 text-gray-400" />
              Mi Perfil
            </Link>
            
            {userProfile.role === 'EXECUTIVE' && (
              <Link 
                href="/admin/users" 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setMenuOpen(false)}
              >
                <UserCog className="mr-3 h-4 w-4 text-gray-400" />
                Gestionar Usuarios
              </Link>
            )}
          </div>
          
          <div className="py-1 border-t border-gray-100">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="mr-3 h-4 w-4 text-red-500" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 