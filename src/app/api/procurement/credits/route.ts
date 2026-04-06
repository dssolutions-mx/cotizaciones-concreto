import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** GET /api/procurement/credits — PO line credits for credit notes dashboard */
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
    const supplierId = searchParams.get('supplier_id') || undefined;
    const dateFrom = searchParams.get('date_from') || undefined;
    const dateTo = searchParams.get('date_to') || undefined;

    let itemQuery = supabase
      .from('purchase_order_items')
      .select(
        `
        id,
        po_id,
        material_id,
        credit_amount,
        credit_applied_at,
        credit_notes,
        unit_price,
        is_service,
        purchase_orders (
          po_number,
          plant_id,
          supplier_id,
          supplier:suppliers!supplier_id (name)
        )
      `
      )
      .gt('credit_amount', 0)
      .order('credit_applied_at', { ascending: false })
      .limit(500);

    if (dateFrom) itemQuery = itemQuery.gte('credit_applied_at', `${dateFrom}T00:00:00`);
    if (dateTo) itemQuery = itemQuery.lte('credit_applied_at', `${dateTo}T23:59:59`);

    const { data, error } = await itemQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = (data || []).map((row: Record<string, unknown>) => {
      const po = row.purchase_orders as
        | {
            po_number?: string;
            plant_id?: string;
            supplier_id?: string;
            supplier?: { name?: string };
          }
        | null
        | undefined;
      return {
        id: row.id,
        po_id: row.po_id,
        po_number: po?.po_number,
        supplier_name: po?.supplier?.name,
        plant_id: po?.plant_id,
        supplier_id: po?.supplier_id,
        credit_amount: row.credit_amount,
        credit_applied_at: row.credit_applied_at,
        credit_notes: row.credit_notes,
        unit_price: row.unit_price,
        is_service: row.is_service,
      };
    });

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      rows = rows.filter((r) => r.plant_id === profile.plant_id);
    } else if (plantId) {
      rows = rows.filter((r) => r.plant_id === plantId);
    }
    if (supplierId) {
      rows = rows.filter((r) => r.supplier_id === supplierId);
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('GET /api/procurement/credits', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
