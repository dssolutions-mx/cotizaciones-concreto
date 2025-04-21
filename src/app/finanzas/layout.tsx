import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import PreloadFinancialData from '@/components/finanzas/PreloadFinancialData';
import QuickAddPaymentButton from '@/components/finanzas/QuickAddPaymentButton';

export const metadata: Metadata = {
  title: 'Finanzas | Concretos DC',
  description: 'Panel de finanzas y gestión de pagos',
};

export default async function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize Supabase for potential prefetch
  await createServerSupabaseClient();
  
  return (
    <>
      {/* Preload component to trigger data fetch in client */}
      <PreloadFinancialData />
      
      {/* Fixed action bar */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold tracking-tight">Centro Financiero</h1>
          <div className="flex items-center gap-2">
            <QuickAddPaymentButton />
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <main className="py-4">
        {children}
      </main>
    </>
  );
} 