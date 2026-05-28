import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = 'inventory-closure-evidence';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: closureId } = await params;

    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await authClient
      .from('user_profiles')
      .select('role, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profile || !CLOSURE_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Check closure is not sealed/cancelled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closure } = await (authClient as any)
      .from('inventory_closures')
      .select('status')
      .eq('id', closureId)
      .single();

    if (!closure) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    if (['sealed', 'cancelled'].includes(closure.status)) {
      return NextResponse.json({ error: 'No se puede adjuntar evidencia a un cierre sellado' }, { status: 409 });
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const materialId = formData.get('material_id') as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx. 15 MB)' }, { status: 413 });
    }

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = materialId
      ? `${closureId}/${materialId}/${Date.now()}_${sanitized}`
      : `${closureId}/general/${Date.now()}_${sanitized}`;

    const admin = createAdminClientForApi();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: evidence, error: dbError } = await (authClient as any)
      .from('inventory_closure_evidence')
      .insert({
        closure_id: closureId,
        material_id: materialId || null,
        file_path: storagePath,
        file_type: file.type,
        original_name: file.name,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: `Error al registrar evidencia: ${dbError.message}` }, { status: 500 });
    }

    // Return signed URL for immediate display
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      success: true,
      evidence: { ...evidence, signed_url: signed?.signedUrl ?? null },
    }, { status: 201 });

  } catch (error) {
    console.error('[POST evidence]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
