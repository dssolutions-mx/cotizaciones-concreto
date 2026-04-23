import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { evaluateFormula, parseFormula } from '@/lib/ema/formula';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const BodySchema = z.object({
  expr: z.string().min(1),
  scope: z.record(z.number()).default({}),
});

/** POST /api/ema/templates/[id]/evaluate-preview — evaluate a formula with sample scope */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    try {
      const ast = parseFormula(parsed.data.expr);
      const value = evaluateFormula(ast, parsed.data.scope);
      return NextResponse.json({ data: { value } });
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Error al evaluar' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
