'use client';

import React, { memo } from 'react';
import { Toaster } from 'react-hot-toast';
import '../../app/globals.css';

// Optimizamos con memo para evitar re-renderizados innecesarios
const MemoizedToaster = memo(() => <Toaster position="top-right" />);
// Add display name to fix the linting issue
MemoizedToaster.displayName = 'MemoizedToaster';

export default function LandingLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <>
      {children}
      <MemoizedToaster />
    </>
  );
} 