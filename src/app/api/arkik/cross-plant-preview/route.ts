import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();

// Simple in-memory rate limiter per user session (max 10 preview lookups per session)
const lookupCounts = new Map<string, number>();

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const plant_id = searchParams.get('plant_id');
    const remision_number = searchParams.get('remision_number');

    if (!plant_id || !remision_number) {
      return NextResponse.json({ error: 'Missing plant_id or remision_number' }, { status: 400 });
    }

    // Rate limit per user
    const count = lookupCounts.get(user.id) || 0;
    if (count >= 20) {
      return NextResponse.json({ error: 'Too many lookup attempts' }, { status: 429 });
    }
    lookupCounts.set(user.id, count + 1);
    // Reset counter after 10 minutes
    setTimeout(() => {
      const current = lookupCounts.get(user.id) || 0;
      if (current > 0) lookupCounts.set(user.id, current - 1);
    }, 10 * 60 * 1000);

    // Use service role to bypass RLS — dosificador at Plant B cannot see Plant A's data
    const { data: remision, error } = await supabaseAdmin
      .from('remisiones')
      .select(`
        id,
        remision_number,
        volumen_fabricado,
        fecha,
        is_production_record,
        orders (
          id,
          client_id,
          construction_site,
          clients (
            name,
            razon_social
          )
        )
      `)
      .eq('remision_number', remision_number.trim())
      .eq('plant_id', plant_id)
      .eq('is_production_record', false)
      .maybeSingle();

    if (error) throw error;

    if (!remision) {
      return NextResponse.json({ found: false });
    }

    const order = Array.isArray(remision.orders) ? remision.orders[0] : remision.orders;
    const client = order?.clients
      ? (Array.isArray(order.clients) ? order.clients[0] : order.clients)
      : null;

    return NextResponse.json({
      found: true,
      remision_id: remision.id,
      remision_number: remision.remision_number,
      volumen_fabricado: remision.volumen_fabricado,
      fecha: remision.fecha,
      client_name: client?.razon_social || client?.name || null,
      construction_site: order?.construction_site || null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
