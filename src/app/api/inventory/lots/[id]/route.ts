import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialLotService } from '@/services/materialLotService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeBreakdown = searchParams.get('breakdown') === 'true';

    const service = new MaterialLotService();

    if (includeBreakdown) {
      const breakdown = await service.getLotCostBreakdown(id);
      if (!breakdown) {
        return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: breakdown });
    }

    const lot = await service.getLotDetail(id);
    if (!lot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: lot });
  } catch (error) {
    console.error('GET /api/inventory/lots/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const service = new MaterialLotService();
    const lot = await service.updateLotMetadata(id, body);

    return NextResponse.json({ success: true, data: lot });
  } catch (error) {
    console.error('PUT /api/inventory/lots/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
