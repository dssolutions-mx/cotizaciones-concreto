import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/materials/missing-supplier
 * Lists active materials with no supplier_id (for data cleanup / catálogo alignment).
 * Restricted to roles that manage materials or procurement.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'QUALITY_TEAM', 'ADMINISTRATIVE'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from('materials')
      .select('id, material_code, material_name, plant_id, is_active')
      .is('supplier_id', null)
      .eq('is_active', true)
      .order('material_name');

    if (error) {
      console.error('missing-supplier diagnostic:', error);
      return NextResponse.json({ error: 'Failed to load materials' }, { status: 500 });
    }

    const byPlant: Record<string, number> = {};
    for (const r of rows || []) {
      const pid = (r as { plant_id?: string | null }).plant_id || '_sin_planta';
      byPlant[pid] = (byPlant[pid] || 0) + 1;
    }

    const { data: plants } = await supabase.from('plants').select('id, code, name');
    const plantLabels: Record<string, string> = {};
    for (const p of plants || []) {
      plantLabels[(p as { id: string }).id] = `${(p as { code?: string }).code ?? ''} — ${(p as { name?: string }).name ?? ''}`;
    }

    return NextResponse.json({
      total_count: (rows || []).length,
      by_plant: byPlant,
      by_plant_labels: Object.fromEntries(
        Object.entries(byPlant).map(([pid, n]) => [plantLabels[pid] ?? pid, n])
      ),
      materials: rows || [],
    });
  } catch (e) {
    console.error('GET /api/materials/missing-supplier', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
