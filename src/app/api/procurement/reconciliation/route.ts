import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/procurement/reconciliation
 * Highlights PO lines with quantity gaps (ordered vs received) as a 3-way match helper.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || undefined;

    let q = supabase
      .from('purchase_order_items')
      .select(
        `
        id,
        po_id,
        material_id,
        qty_ordered,
        qty_received,
        unit_price,
        status,
        is_service,
        material:materials!material_id (material_name),
        purchase_orders!inner (po_number, plant_id, status, supplier:suppliers!supplier_id(name))
      `
      )
      .eq('is_service', false)
      .in('status', ['open', 'partial'])
      .limit(300);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: Array<{
      po_number: string;
      supplier: string;
      plant_id: string;
      material: string;
      ordered: number;
      received: number;
      gap: number;
      severity: 'ok' | 'partial' | 'missing';
    }> = [];

    for (const row of data || []) {
      const po = row.purchase_orders as {
        po_number?: string;
        plant_id?: string;
        status?: string;
        supplier?: { name?: string };
      };
      if (!po) continue;
      if (profile.role === 'PLANT_MANAGER' && profile.plant_id && po.plant_id !== profile.plant_id) {
        continue;
      }
      if (plantId && po.plant_id !== plantId) continue;

      const ordered = Number(row.qty_ordered) || 0;
      const received = Number(row.qty_received) || 0;
      const gap = ordered - received;
      if (gap < 1e-6) continue;

      const mat = (row.material as { material_name?: string })?.material_name || 'Material';
      let severity: 'ok' | 'partial' | 'missing' = 'partial';
      if (received <= 1e-6) severity = 'missing';

      rows.push({
        po_number: po.po_number || '',
        supplier: po.supplier?.name || '—',
        plant_id: po.plant_id || '',
        material: mat,
        ordered,
        received,
        gap,
        severity,
      });
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('GET /api/procurement/reconciliation', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
