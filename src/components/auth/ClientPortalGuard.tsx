'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export default function ClientPortalGuard({
  children
}: {
  children: React.ReactNode
}) {
  const { profile, isLoading, session } = useAuthBridge();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while still loading
    if (isLoading) return;

    // If no session, redirect to login
    if (!session) {
      console.log('ClientPortalGuard: No session, redirecting to login');
      router.replace('/login');
      return;
    }

    // If no profile loaded yet, wait (it should load automatically via Zustand)
    if (!profile) {
      console.log('ClientPortalGuard: No profile yet, waiting for Zustand to load it');
      return;
    }

    // Check if user is external client
    if (profile.role !== 'EXTERNAL_CLIENT') {
      console.log(`ClientPortalGuard: User role ${profile.role} is not EXTERNAL_CLIENT, redirecting to dashboard`);
      router.replace('/dashboard');
      return;
    }

    // Note: Portal access is controlled via the EXTERNAL_CLIENT role
    // Additional portal enablement flags can be added later if needed

    console.log('ClientPortalGuard: Access granted for external client');

  }, [isLoading, profile, session, router]);

  // Show loading while initializing or while redirecting
  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Verificando acceso...</p>
          <p className="text-slate-500 text-sm mt-1">Portal de Cliente</p>
        </div>
      </div>
    );
  }

  // Show loading while profile is being loaded
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando perfil...</p>
          <p className="text-slate-500 text-sm mt-1">Portal de Cliente</p>
        </div>
      </div>
    );
  }

  // Block access if not external client
  if (profile.role !== 'EXTERNAL_CLIENT') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">
            Este portal es exclusivo para clientes externos autorizados.
          </p>
          <p className="text-sm text-slate-500">
            Serás redirigido automáticamente...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}