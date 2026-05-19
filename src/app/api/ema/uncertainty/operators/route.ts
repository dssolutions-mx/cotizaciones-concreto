import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !READ_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { data: operators, error: opError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, role')
      .in('role', ['LABORATORY', 'QUALITY_TEAM'])
      .eq('is_active', true)
      .order('first_name');

    if (opError) throw opError;

    const data = (operators ?? []).map((o) => {
      const row = o as {
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        role: string;
      };
      const full_name =
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;
      return { id: row.id, email: row.email, full_name, role: row.role };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/operators]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
