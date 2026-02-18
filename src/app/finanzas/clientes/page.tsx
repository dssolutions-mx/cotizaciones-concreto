import { createServiceClient } from '@/lib/supabase/server';
import CarteraCxCDashboard from '@/components/finanzas/CarteraCxCDashboard';
import { financialService } from '@/lib/supabase/financial';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function CarteraCxCPage() {
  const serviceClient = createServiceClient();
  const clientBalances = await financialService.getClientBalancesForTable(serviceClient);

  return (
    <div className="container mx-auto p-6">
      <CarteraCxCDashboard clientBalances={clientBalances} />
    </div>
  );
}
