import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export type ClientEnriched = {
  id: string;
  business_name: string;
  client_code: string | null;
  current_balance: number;
  credit_status: string;
  approval_status: string;
  sites_count: number;
  sites_pending_count: number;
};

export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    const serviceClient = createServiceClient();

    const [clientsResult, balancesResult, sitesResult] = await Promise.all([
      serviceClient
        .from('clients')
        .select('id, business_name, client_code, credit_status, approval_status')
        .order('business_name'),
      serviceClient
        .from('client_balances')
        .select('client_id, current_balance')
        .is('construction_site', null)
        .is('construction_site_id', null),
      serviceClient
        .from('construction_sites')
        .select('client_id, approval_status'),
    ]);

    const clients = clientsResult.data || [];
    const balanceMap = new Map<string, number>();
    (balancesResult.data || []).forEach((r: { client_id: string; current_balance: number }) => {
      balanceMap.set(r.client_id, r.current_balance ?? 0);
    });

    const sitesByClient = new Map<string, { total: number; pending: number }>();
    (sitesResult.data || []).forEach((s: { client_id: string; approval_status?: string }) => {
      const current = sitesByClient.get(s.client_id) ?? { total: 0, pending: 0 };
      current.total += 1;
      if (s.approval_status === 'PENDING_APPROVAL') current.pending += 1;
      sitesByClient.set(s.client_id, current);
    });

    const enriched: ClientEnriched[] = clients.map((c: { id: string; business_name: string; client_code: string | null; credit_status?: string; approval_status?: string }) => {
      const sites = sitesByClient.get(c.id) ?? { total: 0, pending: 0 };
      return {
        id: c.id,
        business_name: c.business_name,
        client_code: c.client_code,
        current_balance: balanceMap.get(c.id) ?? 0,
        credit_status: (c.credit_status || 'pending').toLowerCase(),
        approval_status: (c.approval_status || 'PENDING_APPROVAL').toUpperCase(),
        sites_count: sites.total,
        sites_pending_count: sites.pending,
      };
    });

    return NextResponse.json({ clients: enriched });
  } catch (error) {
    console.error('Error fetching enriched clients:', error);
    return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 });
  }
}
