import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EMA_CERTIFICADO_WRITE_ROLES } from '@/lib/ema/emaCertificadoWriteRoles';
import { syncInstrumentUncertaintyFromVigenteCertificado } from '@/services/emaInstrumentoService';
import type { UserRole } from '@/store/auth/types';

/**
 * POST — Re-copy U, k, unidad from the latest vigente certificado onto `instrumentos`.
 * Use after correcting cert data or if the ficha quedó desalineada por permisos antiguos.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: instrumentoId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile as { role: string } | null)?.role;
    if (!role || !EMA_CERTIFICADO_WRITE_ROLES.includes(role as UserRole)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { data: inst, error: iErr } = await supabase
      .from('instrumentos')
      .select('id, tipo')
      .eq('id', instrumentoId)
      .maybeSingle();
    if (iErr) throw iErr;
    const tipo = (inst as { tipo?: string } | null)?.tipo;
    if (!inst) return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404 });
    if (tipo !== 'A' && tipo !== 'B') {
      return NextResponse.json(
        { error: 'Solo aplica a instrumentos tipo A o B con certificado de laboratorio.' },
        { status: 400 },
      );
    }

    await syncInstrumentUncertaintyFromVigenteCertificado(instrumentoId);

    const { data: row, error: rErr } = await supabase
      .from('instrumentos')
      .select('id, incertidumbre_expandida, incertidumbre_k, incertidumbre_unidad')
      .eq('id', instrumentoId)
      .single();
    if (rErr) throw rErr;

    return NextResponse.json({ data: row });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al sincronizar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
