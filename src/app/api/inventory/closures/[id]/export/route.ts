import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InventoryClosureService } from '@/services/inventoryClosureService';
import { buildInventoryClosureExcel } from '@/lib/reports/inventoryClosureExcel';
import { createAdminClientForApi } from '@/lib/supabase/api';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
const BUCKET = 'inventory-closure-evidence';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !CLOSURE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const service = new InventoryClosureService(supabase);
    const detail = await service.getClosureDetail(closureId);

    // If already exported, redirect to signed URL
    if (detail.excel_export_path) {
      const admin = createAdminClientForApi();
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(detail.excel_export_path, 900);
      if (signed?.signedUrl) {
        return NextResponse.redirect(signed.signedUrl);
      }
    }

    const buffer = await buildInventoryClosureExcel(detail, supabase);
    const fileName = `Cierre_Inventario_${detail.period_start}_${detail.period_end}.xlsx`;

    // Persist to storage so re-downloads are cheap
    const admin = createAdminClientForApi();
    const storagePath = `${closureId}/exports/${fileName}`;
    await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true });

    await service.updateExcelPath(closureId, storagePath);

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
