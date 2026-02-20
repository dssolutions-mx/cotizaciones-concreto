import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POCreditInputSchema } from '@/lib/validations/po';

/**
 * POST /api/po/items/[itemId]/credit
 * Apply credit/discount to a purchase order item and retroactively update all linked entries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check permissions (EXECUTIVE, ADMIN_OPERATIONS)
    const allowedRoles = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para aplicar créditos a órdenes de compra' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const payload = POCreditInputSchema.parse(body);

    // Fetch PO item
    const { data: poItem, error: poItemError } = await supabase
      .from('purchase_order_items')
      .select('*, po:purchase_orders!po_id (id, plant_id, status)')
      .eq('id', itemId)
      .single();

    if (poItemError || !poItem) {
      return NextResponse.json({ error: 'Item de PO no encontrado' }, { status: 404 });
    }

    // Validate PO item is not cancelled
    if (poItem.status === 'cancelled') {
      return NextResponse.json(
        { error: 'No se puede aplicar crédito a un item de PO cancelado' },
        { status: 400 }
      );
    }

    // Always compute against the ABSOLUTE original price (first-ever price before any credits)
    const absoluteOriginalUnitPrice = poItem.original_unit_price
      ? Number(poItem.original_unit_price)
      : Number(poItem.unit_price);
    const absoluteOriginalTotal = Number(poItem.qty_ordered) * absoluteOriginalUnitPrice;

    // Cumulative credit: add new credit to any existing credit amount
    const existingCredit = poItem.credit_amount ? Number(poItem.credit_amount) : 0;
    const cumulativeCredit = existingCredit + payload.credit_amount;

    if (cumulativeCredit > absoluteOriginalTotal) {
      return NextResponse.json(
        {
          error: `El crédito acumulado ($${cumulativeCredit.toLocaleString('es-MX')}) no puede exceder el total original del PO ($${absoluteOriginalTotal.toLocaleString('es-MX')}). Crédito previo aplicado: $${existingCredit.toLocaleString('es-MX')}`,
        },
        { status: 400 }
      );
    }

    // New unit price calculated from absolute original minus cumulative credit
    const newTotal = absoluteOriginalTotal - cumulativeCredit;
    const newUnitPrice = newTotal / Number(poItem.qty_ordered);

    // Update PO item — store cumulative credit and preserve absolute original
    const { error: updatePoItemError } = await supabase
      .from('purchase_order_items')
      .update({
        unit_price: newUnitPrice,
        original_unit_price: absoluteOriginalUnitPrice,
        credit_amount: cumulativeCredit,
        credit_applied_at: new Date().toISOString(),
        credit_applied_by: user.id,
        credit_notes: payload.credit_notes || null,
      })
      .eq('id', itemId);

    if (updatePoItemError) {
      console.error('Error updating PO item:', updatePoItemError);
      return NextResponse.json(
        { error: 'Error al actualizar item de PO' },
        { status: 500 }
      );
    }

    // C1 — Insert credit history record (gap C2)
    await supabase.from('po_item_credit_history').insert({
      po_item_id: itemId,
      applied_amount: payload.credit_amount,
      cumulative_amount_after: cumulativeCredit,
      unit_price_before: Number(poItem.unit_price),
      unit_price_after: newUnitPrice,
      notes: payload.credit_notes || null,
      applied_by: user.id,
    });

    // Find all material entries linked to this PO item
    const { data: linkedEntries, error: entriesError } = await supabase
      .from('material_entries')
      .select('id, quantity_received, received_qty_kg, unit_price, original_unit_price')
      .eq('po_item_id', itemId);

    if (entriesError) {
      console.error('Error fetching linked entries:', entriesError);
      // Continue anyway - credit is applied to PO item
    }

    // Update all linked entries
    let entriesUpdated = 0;
    if (linkedEntries && linkedEntries.length > 0) {
      for (const entry of linkedEntries) {
        // Store original unit price if not already set
        const entryOriginalPrice = entry.original_unit_price
          ? Number(entry.original_unit_price)
          : (entry.unit_price ? Number(entry.unit_price) : absoluteOriginalUnitPrice);

        // Calculate new total cost based on received quantity
        const receivedQty = entry.received_qty_kg
          ? Number(entry.received_qty_kg)
          : Number(entry.quantity_received);
        const newTotalCost = receivedQty * newUnitPrice;

        const { error: updateEntryError } = await supabase
          .from('material_entries')
          .update({
            unit_price: newUnitPrice,
            total_cost: newTotalCost,
            original_unit_price: entryOriginalPrice,
            price_adjusted_at: new Date().toISOString(),
            price_adjusted_by: user.id,
          })
          .eq('id', entry.id);

        if (updateEntryError) {
          console.error(`Error updating entry ${entry.id}:`, updateEntryError);
          // Continue with other entries
        } else {
          entriesUpdated++;
        }
      }
    }

    // Fetch updated PO item with credit info
    const { data: updatedPoItem } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('id', itemId)
      .single();

    return NextResponse.json(
      {
        success: true,
        item: updatedPoItem,
        entriesUpdated,
        creditApplied: {
          appliedAmount: payload.credit_amount,
          cumulativeCredit: cumulativeCredit,
          newUnitPrice: newUnitPrice,
          originalUnitPrice: absoluteOriginalUnitPrice,
          originalTotal: absoluteOriginalTotal,
          newTotal: newTotal,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error applying PO credit:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error al aplicar crédito a PO' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/po/items/[itemId]/credit
 * Get credit history for a PO item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Fetch PO item with credit info
    const { data: poItem, error: poItemError } = await supabase
      .from('purchase_order_items')
      .select(
        'id, credit_amount, credit_applied_at, credit_notes, original_unit_price, unit_price, credit_applied_by, credit_applied_by_user:user_profiles!credit_applied_by (id, first_name, last_name, email)'
      )
      .eq('id', itemId)
      .single();

    if (poItemError || !poItem) {
      return NextResponse.json({ error: 'Item de PO no encontrado' }, { status: 404 });
    }

    // C2 — Fetch full credit history (gap C2)
    const { data: history } = await supabase
      .from('po_item_credit_history')
      .select('id, applied_amount, cumulative_amount_after, unit_price_before, unit_price_after, notes, applied_by, applied_at')
      .eq('po_item_id', itemId)
      .order('applied_at', { ascending: true });

    return NextResponse.json({
      success: true,
      creditInfo: {
        hasCredit: !!poItem.credit_amount,
        creditAmount: poItem.credit_amount,
        creditAppliedAt: poItem.credit_applied_at,
        creditNotes: poItem.credit_notes,
        originalUnitPrice: poItem.original_unit_price,
        currentUnitPrice: poItem.unit_price,
        appliedBy: poItem.credit_applied_by_user,
      },
      history: history || [],
    });
  } catch (error: any) {
    console.error('Error fetching PO credit info:', error);
    return NextResponse.json(
      { error: 'Error al obtener información de crédito' },
      { status: 500 }
    );
  }
}
