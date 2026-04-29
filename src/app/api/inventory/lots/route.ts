import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialLotService } from '@/services/materialLotService';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || profile.plant_id;

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id requerido' }, { status: 400 });
    }

    const hr = searchParams.get('has_remaining');
    const hasRemainingFilter =
      hr === 'true' ? true : hr === 'false' ? false : undefined;

    const service = new MaterialLotService();
    const result = await service.getLotsByPlant(plantId, {
      material_id: searchParams.get('material_id') || undefined,
      supplier_id: searchParams.get('supplier_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      has_remaining: hasRemainingFilter,
      quality_status: (searchParams.get('quality_status') as 'pending' | 'approved' | 'rejected' | 'na') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('GET /api/inventory/lots error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
