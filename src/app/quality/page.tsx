'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QualityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/quality/operaciones');
  }, [router]);

  return null;
}
