'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useReleaseAnnouncement } from '@/hooks/useReleaseAnnouncement';
import { WhatsNewModal } from './WhatsNewModal';

const EXCLUDED_ROUTES = ['/login', '/auth', '/reset-password', '/update-password', '/landing', '/client-portal'];

/**
 * Muestra el modal de novedades una vez por versión por usuario.
 * Solo se renderiza cuando hay sesión, no está en rutas de auth, y el usuario no ha visto esta versión.
 */
export function ReleaseAnnouncementGate() {
  const pathname = usePathname();
  const { profile } = useAuthBridge();
  const { shouldShow, isLoading, markViewed } = useReleaseAnnouncement();

  const isExcludedRoute = pathname ? EXCLUDED_ROUTES.some((r) => pathname.startsWith(r)) : false;
  if (!profile?.id || isLoading || !shouldShow || isExcludedRoute) return null;

  return (
    <WhatsNewModal
      open={shouldShow}
      onClose={markViewed}
      role={profile.role}
    />
  );
}
