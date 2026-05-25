import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MANAGE_ROLES = ['EXECUTIVE', 'ADMIN'];

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ measurandId: string; inputId: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !MANAGE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { measurandId, inputId } = await params;

    const { data, error: delErr } = await supabase
      .from('ema_uncertainty_measurand_inputs')
      .delete()
      .eq('id', inputId)
      .eq('measurand_id', measurandId)
      .select('id')
      .single();

    if (delErr || !data) {
      return NextResponse.json({ error: 'Variable no encontrada' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/ema/uncertainty/measurands/[measurandId]/inputs/[inputId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
