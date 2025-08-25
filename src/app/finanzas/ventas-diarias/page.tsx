import { Suspense } from 'react';
import { format } from 'date-fns';
import { FinancialDashboardSkeleton } from '@/components/finanzas/FinancialDashboardSkeleton';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { SalesMetrics } from '@/components/finanzas/SalesMetrics';
import { DailySalesTable } from '@/components/finanzas/DailySalesTable';
import { DatePickerWithButton } from '@/components/finanzas/DatePickerWithButton';

// Enable ISR with 5-minute revalidation interval
export const revalidate = 300; // 5 minutes in seconds

export default async function DailySalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Get the date from query params or use today's date
  const params = await searchParams;
  const dateParam = params.date ? String(params.date) : format(new Date(), 'yyyy-MM-dd');
  
  return (
    <Suspense fallback={<FinancialDashboardSkeleton />}>
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Reporte de Ventas Diarias</h1>
          <div className="flex items-center gap-2">
            <DatePickerWithButton currentDate={dateParam} />
          </div>
        </div>
        
        {/* Plant Context Display */}
        <div className="mb-6">
          <PlantContextDisplay showLabel={true} />
        </div>
        
        <RoleProtectedSection
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          action="ver información de ventas diarias"
        >
          <div className="space-y-8">
            {/* Sales metrics summary cards with separate suspense boundary */}
            <Suspense fallback={<SalesMetricsSkeleton />}>
              <SalesMetrics date={dateParam} />
            </Suspense>
            
            {/* Daily sales table */}
            <Suspense fallback={<DailySalesTableSkeleton />}>
              <DailySalesTable date={dateParam} />
            </Suspense>
          </div>
        </RoleProtectedSection>
      </div>
    </Suspense>
  );
}

// Sales Metrics Section Skeleton
function SalesMetricsSkeleton() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Diarias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-full border-s-4 border-s-gray-300 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between space-y-0 pb-1 p-6">
              <div className="text-sm font-medium">Cargando...</div>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold mb-1">--</div>
              <p className="text-xs text-muted-foreground">Cargando datos...</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Daily Sales Table Skeleton
function DailySalesTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Detalle de Ventas</h3>
        <p className="text-sm text-muted-foreground">
          Cargando detalles de ventas...
        </p>
      </div>
      <div className="p-6 pt-0">
        <div className="h-[400px] w-full flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos de ventas...</p>
        </div>
      </div>
    </div>
  );
} 