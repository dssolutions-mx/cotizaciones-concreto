'use client';

import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import '../../app/globals.css';

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