'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { UserCircle, LogOut, Settings, UserCog } from 'lucide-react';
import Link from 'next/link';

export default function UserProfile() {
  const { profile, signOut, isLoading, session } = useAuthBridge();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // Memoize display name to prevent unnecessary re-renders
  const displayName = useMemo(() => {
    if (!profile) return '';
    return profile.first_name || profile.email.split('@')[0];
  }, [profile]);

  // Function to handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="h-24 w-24 mask mask-hexagon bg-gray-100 flex items-center justify-center shadow-sm">
            {profile?.first_name ? (
              <span className="text-4xl font-bold text-gray-600">{profile.first_name.charAt(0)}{profile.last_name?.charAt(0)}</span>
            ) : (
              <UserCircle className="h-16 w-16 text-gray-600" />
            )}
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-center text-gray-800 @lg:text-2xl">
          {profile?.first_name} {profile?.last_name}
        </h2>
        <p className="text-sm text-center text-gray-500 mt-1 @lg:text-base">
          {profile?.email}
        </p>
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {roleDisplay}
          </span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="space-y-3">
          <Link 
            href="/profile/update" 
            className="flex items-center text-sm text-gray-700 hover:text-indigo-600"
          >
            <Settings className="mr-2 h-4 w-4" />
            Editar perfil
          </Link>
          
          {profile.role === 'EXECUTIVE' && (
            <Link 
              href="/admin/users" 
              className="flex items-center text-sm text-gray-700 hover:text-indigo-600"
            >
              <UserCog className="mr-2 h-4 w-4" />
              Gestionar usuarios
            </Link>
          )}
          
          <button
            onClick={handleSignOut}
            className="flex w-full items-center text-sm text-red-600 hover:text-red-800"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
} 