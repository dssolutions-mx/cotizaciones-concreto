'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle, LogOut, Settings, UserCog } from 'lucide-react';
import Link from 'next/link';

export default function ProfileMenu() {
  const { profile, signOut, isLoading, session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Memoize display name to prevent unnecessary re-renders
  const displayName = useMemo(() => {
    if (!profile) return '';
    if (profile.first_name) return profile.first_name;
    return profile.email.split('@')[0];
  }, [profile]);

  // Memoize role display to prevent unnecessary re-renders
  const roleDisplay = useMemo(() => {
    if (!profile) return '';
    switch (profile.role) {
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
        return profile.role;
    }
  }, [profile]);

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

  // Render a placeholder during server-side rendering
  // and before hydration is complete to prevent mismatch
  if (!isClient) {
    return <div className="flex items-center" aria-hidden="true">
      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
    </div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center">
        <div className="animate-pulse w-8 h-8 rounded-full bg-gray-200"></div>
      </div>
    );
  }

  if (!session) {
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
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600 mask mask-circle shadow-md shadow-indigo-100/50">
          <UserCircle className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-gray-700 hidden md:block">
          {displayName}
        </span>
      </button>

      {menuOpen && profile && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 mask mask-squircle bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md shadow-indigo-400/20">
                <span className="text-lg font-semibold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="font-medium text-gray-800 text-shadow-xs">{profile.first_name} {profile.last_name}</div>
                <div className="text-sm text-gray-500 truncate">{profile.email}</div>
              </div>
            </div>
            <div className="text-xs font-medium text-indigo-600 mt-2 flex justify-end">
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
            
            {profile.role === 'EXECUTIVE' && (
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