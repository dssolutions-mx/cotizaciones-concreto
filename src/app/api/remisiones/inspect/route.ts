import { NextRequest, NextResponse } from 'next/server';
import { authorizeRemisionInspect } from '@/lib/remisiones/inspectAuth';
import { searchRemisionesForInspect } from '@/services/remisionInspectService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPlantId = searchParams.get('plant_id');

    const authResult = await authorizeRemisionInspect(requestedPlantId);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.message },
        { status: authResult.status, headers: NO_STORE },
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const dateFrom = searchParams.get('date_from') || today;
    const dateTo = searchParams.get('date_to') || today;
    const q = searchParams.get('q') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 80, 150) : 80;

    const result = await searchRemisionesForInspect({
      plantId: authResult.auth.plantId!,
      dateFrom,
      dateTo,
      q,
      limit,
    });

    return NextResponse.json({ success: true, data: result }, { headers: NO_STORE });
  } catch (error) {
    console.error('[remisiones/inspect] GET error:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
