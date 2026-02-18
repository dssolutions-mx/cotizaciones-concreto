import { Suspense } from 'react';
import { format } from 'date-fns';
import { FinancialDashboardSkeleton } from '@/components/finanzas/FinancialDashboardSkeleton';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { SalesMetrics } from '@/components/finanzas/SalesMetrics';
import { DailySalesTable } from '@/components/finanzas/DailySalesTable';
import { DatePickerWithButton } from '@/components/finanzas/DatePickerWithButton';
import { DateRangePickerWithButton } from '@/components/finanzas/DateRangePickerWithButton';
import {
  PaymentMetrics,
  DailyPaymentsTable,
} from '@/components/finanzas/DailyPaymentsReportContent';
import { DailyReportsTabs } from '@/components/finanzas/DailyReportsTabs';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

function toLocalISODate(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}
function parseParam(p: string | string[] | undefined) {
  return Array.isArray(p) ? p[0] : p;
}
function isYMD(s: string | undefined) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tab = parseParam(params.tab) || 'ventas';
  const today = toLocalISODate(new Date());

  const dateParam = params.date ? String(params.date) : format(new Date(), 'yyyy-MM-dd');
  let startDateParam = parseParam(params.start_date) || today;
  let endDateParam = parseParam(params.end_date) || today;
  if (!isYMD(startDateParam)) startDateParam = today;
  if (!isYMD(endDateParam)) endDateParam = today;
  if (startDateParam > endDateParam) {
    [startDateParam, endDateParam] = [endDateParam, startDateParam];
  }

  return (
    <Suspense fallback={<FinancialDashboardSkeleton />}>
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Reporte Diario (Ventas y Pagos)</h1>
          <div className="flex items-center gap-2">
            {tab === 'ventas' ? (
              <DatePickerWithButton currentDate={dateParam} />
            ) : (
              <DateRangePickerWithButton startDate={startDateParam} endDate={endDateParam} />
            )}
          </div>
        </div>

        <div className="mb-6">
          <PlantContextDisplay showLabel={true} />
        </div>

        <RoleProtectedSection
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          action="ver información de ventas y pagos diarios"
        >
          <Suspense fallback={<div className="animate-pulse h-10 bg-muted rounded w-48" />}>
            <DailyReportsTabs
            ventasContent={
              <div className="space-y-8">
                <Suspense fallback={<SalesMetricsSkeleton />}>
                  <SalesMetrics date={dateParam} />
                </Suspense>
                <Suspense fallback={<DailySalesTableSkeleton />}>
                  <DailySalesTable date={dateParam} />
                </Suspense>
              </div>
            }
            pagosContent={
              <div className="space-y-8">
                <Suspense fallback={<PaymentMetricsSkeleton />}>
                  <PaymentMetrics
                    key={`metrics-${startDateParam}-${endDateParam}`}
                    startDate={startDateParam}
                    endDate={endDateParam}
                  />
                </Suspense>
                <Suspense fallback={<DailyPaymentsTableSkeleton />}>
                  <DailyPaymentsTable
                    key={`table-${startDateParam}-${endDateParam}`}
                    startDate={startDateParam}
                    endDate={endDateParam}
                  />
                </Suspense>
              </div>
            }
          />
          </Suspense>
        </RoleProtectedSection>
      </div>
    </Suspense>
  );
}

function SalesMetricsSkeleton() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Diarias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-full border-s-4 border-s-gray-300 rounded-lg border bg-card p-6 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-8 bg-muted rounded w-1/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

function DailySalesTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-6 bg-muted rounded w-1/3 mb-4" />
      <div className="h-[400px] bg-muted/30 rounded animate-pulse" />
    </div>
  );
}

function PaymentMetricsSkeleton() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Pagos Diarios</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-full border-s-4 border-s-gray-300 rounded-lg border bg-card p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-8 bg-muted rounded w-1/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

function DailyPaymentsTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-6 bg-muted rounded w-1/3 mb-4" />
      <div className="h-[400px] bg-muted/30 rounded animate-pulse" />
    </div>
  );
}
