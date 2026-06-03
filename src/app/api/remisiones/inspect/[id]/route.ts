import { NextRequest, NextResponse } from 'next/server';
import { authorizeRemisionInspect } from '@/lib/remisiones/inspectAuth';
import { getRemisionInspectDetail } from '@/services/remisionInspectService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedPlantId = searchParams.get('plant_id');

    const authResult = await authorizeRemisionInspect(requestedPlantId);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.message },
        { status: authResult.status, headers: NO_STORE },
      );
    }

    const detail = await getRemisionInspectDetail(id, authResult.auth.plantId);
    if (!detail) {
      return NextResponse.json(
        { error: 'Remisión no encontrada' },
        { status: 404, headers: NO_STORE },
      );
    }

    return NextResponse.json({ success: true, data: detail }, { headers: NO_STORE });
  } catch (error) {
    console.error('[remisiones/inspect/[id]] GET error:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
