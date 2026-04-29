import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const clientId = resolved.ctx.clientId;

    const { count: orders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);

    const { data: rems } = await supabase
      .from('remisiones')
      .select('volumen_fabricado, tipo_remision, orders!inner(client_id)')
      .eq('orders.client_id', clientId)
      .eq('is_production_record', false)
      .limit(1000);
    const deliveredVolume = (rems || []).reduce((sum: number, r: any) => {
      if (r.tipo_remision === 'BOMBEO') return sum;
      return sum + (Number(r.volumen_fabricado) || 0);
    }, 0);

    const { data: balance } = await supabase
      .from('client_balances')
      .select('current_balance')
      .eq('client_id', clientId)
      .is('construction_site', null)
      .is('construction_site_id', null)
      .limit(1)
      .maybeSingle();

    const { data: latest } = await supabase
      .from('remisiones')
      .select('id, fecha, volumen_fabricado, tipo_remision, remision_number, orders!inner(client_id)')
      .eq('orders.client_id', clientId)
      .order('fecha', { ascending: false })
      .limit(5);

    return NextResponse.json({
      orders: orders || 0,
      deliveredVolume,
      currentBalance: Number((balance as any)?.current_balance || 0),
      recent: (latest || []).map((r: any) => ({
        id: r.id,
        fecha: r.fecha,
        volumen: Number(r.volumen_fabricado) || 0,
        tipo: r.tipo_remision,
        remisionNumber: r.remision_number,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load metrics' }, { status: 500 });
  }
}
