import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getChecklistsByInstrumento, createChecklist } from '@/services/emaInstrumentoService';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN', 'ADMIN_OPERATIONS'];

const ChecklistItemSchema = z.object({
  item_nombre: z.string().min(1),
  passed: z.boolean(),
  observacion: z.string().default(''),
});

const CreateChecklistSchema = z.object({
  tipo_checklist: z.enum(['recepcion', 'periodico', 'post_calibracion', 'post_incidente']),
  fecha_inspeccion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estado_general: z.enum(['bueno', 'regular', 'malo', 'fuera_de_servicio']),
  items: z.array(ChecklistItemSchema).min(1),
  observaciones_generales: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const checklists = await getChecklistsByInstrumento(id);
    return NextResponse.json({ data: checklists });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = CreateChecklistSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const checklist = await createChecklist(
      { ...parsed.data, instrumento_id: id } as any,
      user.id,
    );
    return NextResponse.json({ data: checklist }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
