import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasInventoryStandardAccess, isGlobalInventoryRole } from '@/lib/auth/inventoryRoles';

const BodySchema = z.object({
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/inventory/monthly-closing
 * Seals ADJUSTABLE snapshots up to closing_date (DB function monthly_inventory_closing).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !hasInventoryStandardAccess(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    if (!isGlobalInventoryRole(profile.role)) {
      return NextResponse.json(
        { error: 'Solo roles globales pueden ejecutar cierre mensual' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { closing_date } = BodySchema.parse(body);

    const { data, error: rpcError } = await supabase.rpc('monthly_inventory_closing', {
      p_closing_date: closing_date,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: data,
      closing_date,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', details: error.flatten() }, { status: 400 });
    }
    console.error('[monthly-closing]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
