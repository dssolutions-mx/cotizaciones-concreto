'use client';

import React from 'react';
import { Toaster } from '@/components/ui/toaster';

export default function LandingLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
} 