import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { buildInventoryClosureExcel } from '@/lib/reports/inventoryClosureExcel';
import { createAdminClientForApi } from '@/lib/supabase/api';
import {
  assertClosurePlantAccess,
  canAccessInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles';

const BUCKET = 'inventory-closure-evidence';

export const maxDuration = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;
    const preliminary = request.nextUrl.searchParams.get('preliminary') === '1';

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !canAccessInventoryClosure(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
    const detail = await service.getClosureDetail(closureId);

    try {
      assertClosurePlantAccess(profile, detail.plant_id);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }

    if (preliminary && (detail.status === 'sealed' || detail.status === 'cancelled')) {
      return NextResponse.json(
        { error: 'El reporte preliminar solo aplica a cierres en progreso' },
        { status: 409 },
      );
    }

    // Always rebuild so signatures/evidence are embedded (not expiring signed URLs).
    const admin = createAdminClientForApi();
    const buffer = await buildInventoryClosureExcel(detail, admin, { preliminary });

    const prefix = preliminary ? 'Preliminar' : 'Cierre';
    const fileName = `${prefix}_Inventario_${detail.period_start}_${detail.period_end}.xlsx`;

    if (!preliminary) {
      const storagePath = `${closureId}/exports/${fileName}`;
      await admin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });
      await service.updateExcelPath(closureId, storagePath);
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET export]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
