import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({}, { status: 401 });
    }
    
    // Join remisiones -> orders to aggregate by client without large IN lists
    const { data, error } = await supabase
      .from('remisiones')
      .select('fecha, orders:orders(client_id)')
      .eq('tipo_remision', 'CONCRETO')
      .order('fecha', { ascending: false })
      .limit(2000); // Reasonable limit

    if (error) {
      console.error('Error fetching delivery dates:', error);
      return NextResponse.json({});
    }

    const latestByClient = new Map<string, string>();
    for (const row of (data || []) as Array<{ fecha: string; orders: { client_id: string } | null }>) {
      const clientId = row.orders?.client_id;
      if (!clientId) continue;
      if (!latestByClient.has(clientId)) {
        latestByClient.set(clientId, row.fecha);
      }
    }

    const result: Record<string, { lastDeliveryDate: string | null }> = {};
    for (const [clientId, fecha] of latestByClient.entries()) {
      result[clientId] = { lastDeliveryDate: fecha };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in delivery-dates API:', error);
    return NextResponse.json({});
  }
}
