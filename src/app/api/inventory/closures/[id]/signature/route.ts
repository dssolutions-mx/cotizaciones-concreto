import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';

const SEAL_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
const MAX_BYTES = 5 * 1024 * 1024;
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !SEAL_ROLES.includes(profile.role as string)) {
      return NextResponse.json(
        { error: 'Solo PLANT_MANAGER, ADMIN_OPERATIONS o EXECUTIVE pueden firmar un cierre' },
        { status: 403 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closure } = await (authClient as any)
      .from('inventory_closures')
      .select('status')
      .eq('id', closureId)
      .single();

    if (!closure) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
    if (['sealed', 'cancelled'].includes(closure.status)) {
      return NextResponse.json({ error: 'No se puede firmar un cierre ya sellado o cancelado' }, { status: 409 });
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Firma requerida' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'La firma debe ser una imagen' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Firma demasiado grande (máx. 5 MB)' }, { status: 413 });
    }

    const storagePath = `${closureId}/signatures/${Date.now()}_signature.png`;

    const admin = createAdminClientForApi();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        cacheControl: '31536000',
        upsert: true,
        contentType: file.type || 'image/png',
      });

    if (uploadError) {
      console.error('[POST signature] storage upload', uploadError);
      return NextResponse.json(
        {
          error: `Error al subir firma en bucket "${BUCKET}": ${uploadError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, storage_path: storagePath }, { status: 201 });
  } catch (error) {
    console.error('[POST signature]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
