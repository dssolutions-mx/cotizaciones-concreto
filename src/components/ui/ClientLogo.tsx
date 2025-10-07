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

        // Find client by portal user id and get logo path
        const { data: client } = await supabase
          .from('clients')
          .select('id, business_name, logo_path')
          .eq('portal_user_id', userId)
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


