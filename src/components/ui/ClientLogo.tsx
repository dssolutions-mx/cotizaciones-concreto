'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface ClientLogoProps {
  size?: LogoSize;
  className?: string;
}

export function ClientLogo({ size = 'md', className }: ClientLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        // Get client_id from client_portal_users (multi-user system)
        const { data: association } = await supabase
          .from('client_portal_users')
          .select('client_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        let clientId: string | null = null;

        if (association?.client_id) {
          // Use multi-user system
          clientId = association.client_id;
        } else {
          // Fallback to legacy portal_user_id for backward compatibility
          const { data: legacyClient } = await supabase
            .from('clients')
            .select('id')
            .eq('portal_user_id', userId)
            .maybeSingle();
          
          clientId = legacyClient?.id || null;
        }

        if (!clientId) return;

        // Get logo path from client
        const { data: client } = await supabase
          .from('clients')
          .select('logo_path')
          .eq('id', clientId)
          .maybeSingle();

        const path = (client as any)?.logo_path as string | null;
        if (!path) return;

        const { data: publicUrl } = supabase.storage
          .from('client-logos')
          .getPublicUrl(path);

        if (isMounted) setLogoUrl(publicUrl.publicUrl || null);
      } catch (err) {
        // Silent fail; branding is optional
        console.warn('ClientLogo: unable to load client logo');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const dimensions = {
    sm: { width: 32, height: 32 },
    md: { width: 120, height: 40 },
    lg: { width: 150, height: 50 },
    xl: { width: 200, height: 67 },
  } as const;

  if (!logoUrl) return null;

  return (
    <Image
      src={logoUrl}
      alt="Logo del Cliente"
      width={dimensions[size].width}
      height={dimensions[size].height}
      className={className}
      priority
    />
  );
}


