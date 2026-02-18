'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type TabId = 'ventas' | 'pagos';

export function DailyReportsTabs({
  children,
  ventasContent,
  pagosContent,
}: {
  children?: React.ReactNode;
  ventasContent: React.ReactNode;
  pagosContent: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as TabId) || 'ventas';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams();
    params.set('tab', value);
    if (value === 'pagos') {
      const start = searchParams.get('start_date');
      const end = searchParams.get('end_date');
      const today = new Date().toISOString().slice(0, 10);
      params.set('start_date', start || today);
      params.set('end_date', end || today);
    } else if (value === 'ventas') {
      const date = searchParams.get('date');
      params.set('date', date || new Date().toISOString().slice(0, 10));
    }
    router.push(`/finanzas/ventas-diarias?${params.toString()}`);
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="ventas">Ventas Diarias</TabsTrigger>
        <TabsTrigger value="pagos">Pagos Diarios</TabsTrigger>
      </TabsList>
      <TabsContent value="ventas" className="mt-6">
        {ventasContent}
      </TabsContent>
      <TabsContent value="pagos" className="mt-6">
        {pagosContent}
      </TabsContent>
    </Tabs>
  );
}
