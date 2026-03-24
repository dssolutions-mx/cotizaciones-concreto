import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/po/[id]/receipt-context?material_id=uuid
 *
 * Sanitized PO payload for reception / dosificador verification: supplier, status, line
 * quantities and UoM — never unit_price or monetary totals.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: poId } = await params;
    const { searchParams } = new URL(request.url);
    const materialIdFilter = searchParams.get('material_id') || undefined;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select(
        `
        id,
        plant_id,
        supplier_id,
        status,
        notes,
        po_date,
        supplier:suppliers!supplier_id (
          id,
          name,
          provider_number,
          provider_letter,
          internal_code
        )
      `
      )
      .eq('id', poId)
      .single();

    if (poErr || !po) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    const plantId = po.plant_id as string;

    if (profile.role === 'PLANT_MANAGER' || profile.role === 'DOSIFICADOR') {
      if (profile.plant_id && plantId !== profile.plant_id) {
        if (profile.role === 'DOSIFICADOR') {
          return NextResponse.json({ error: 'No tiene acceso a esta planta' }, { status: 403 });
        }
        const { data: plantRow } = await supabase
          .from('plants')
          .select('business_unit_id')
          .eq('id', plantId)
          .single();
        if (plantRow?.business_unit_id !== profile.business_unit_id) {
          return NextResponse.json({ error: 'No tiene acceso a esta orden' }, { status: 403 });
        }
      }
    }

    let itemsQuery = supabase
      .from('purchase_order_items')
      .select(
        `
        id,
        material_id,
        uom,
        qty_ordered,
        qty_received,
        status,
        is_service,
        material:materials!material_id ( id, material_name )
      `
      )
      .eq('po_id', poId)
      .eq('is_service', false);

    if (materialIdFilter) {
      itemsQuery = itemsQuery.eq('material_id', materialIdFilter);
    }

    const { data: rawItems, error: itemsErr } = await itemsQuery;
    if (itemsErr) {
      console.error('receipt-context items:', itemsErr);
      return NextResponse.json({ error: 'Error al cargar partidas' }, { status: 500 });
    }

    const supplier = Array.isArray(po.supplier) ? po.supplier[0] : po.supplier;

    const items = (rawItems || []).map((row: any) => {
      const ordered = Number(row.qty_ordered) || 0;
      const received = Number(row.qty_received) || 0;
      const remaining = Math.max(ordered - received, 0);
      const mat = Array.isArray(row.material) ? row.material[0] : row.material;
      return {
        id: row.id as string,
        material_id: row.material_id as string | null,
        material_name: (mat?.material_name as string) || 'Material',
        uom: (row.uom as string) || 'kg',
        qty_ordered: ordered,
        qty_received: received,
        qty_remaining: remaining,
        status: row.status as string,
      };
    });

    return NextResponse.json({
      po: {
        id: po.id,
        display_ref: String(po.id).slice(0, 8).toUpperCase(),
        status: po.status,
        plant_id: po.plant_id,
        supplier_id: po.supplier_id,
        po_date: po.po_date ?? null,
        notes: po.notes ?? null,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              provider_number: supplier.provider_number,
              provider_letter: supplier.provider_letter,
              internal_code: supplier.internal_code,
            }
          : null,
      },
      items,
    });
  } catch (e) {
    console.error('GET /api/po/[id]/receipt-context', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
