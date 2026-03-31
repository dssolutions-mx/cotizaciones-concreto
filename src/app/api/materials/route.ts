import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canWriteMaterialsCatalog } from '@/lib/auth/materialsCatalogRoles';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    const supplierId = searchParams.get('supplier_id');
    const activeParam = searchParams.get('active');

    // Build query for materials
    // IMPORTANT: RLS policies automatically filter materials based on user role:
    // - EXTERNAL_CLIENT: Only materials from plants where they have orders AND used in those orders
    // - Other roles (QUALITY_TEAM, PLANT_MANAGER, EXECUTIVE, etc.): All materials
    let query = supabase
      .from('materials')
      .select('*')
      .order('material_name');

    // Filter by active status - default to true if not specified
    if (activeParam !== 'false') {
      query = query.eq('is_active', true);
    }

    // Filter by plant if specified
    if (plantId) {
      query = query.eq('plant_id', plantId);
    }

    // Fetch materials (RLS policies automatically apply client-specific filtering)
    const { data: materials, error } = await query;

    if (error) {
      console.error('Error fetching materials:', error);
      return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
    }

    let augmented = materials || [];

    // Optional: enrich with supplier agreement + PO history flags for PO creation UX
    if (supplierId && plantId && augmented.length > 0) {
      const { data: agreements } = await supabase
        .from('supplier_agreements')
        .select('material_id')
        .eq('supplier_id', supplierId)
        .eq('is_service', false)
        .is('effective_to', null)
        .not('material_id', 'is', null);

      const agreementSet = new Set(
        (agreements || []).map((a: { material_id?: string }) => a.material_id).filter(Boolean) as string[]
      );

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('plant_id', plantId);

      const poIds = (pos || []).map((p: { id: string }) => p.id);
      const historySet = new Set<string>();
      if (poIds.length > 0) {
        const { data: lines } = await supabase
          .from('purchase_order_items')
          .select('material_id')
          .in('po_id', poIds)
          .not('material_id', 'is', null);
        for (const l of lines || []) {
          const mid = (l as { material_id?: string }).material_id;
          if (mid) historySet.add(mid);
        }
      }

      augmented = augmented.map((m: Record<string, unknown> & { id: string }) => ({
        ...m,
        has_supplier_agreement: agreementSet.has(m.id),
        has_po_history_with_supplier: historySet.has(m.id),
      }));
    }

    return NextResponse.json({ success: true, data: augmented });
  } catch (error) {
    console.error('Error in materials API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (!canWriteMaterialsCatalog(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.material_code || !body.material_name || !body.category || !body.unit_of_measure) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create material
    const { data: material, error } = await supabase
      .from('materials')
      .insert([{
        ...body,
        plant_id: profile.plant_id || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating material:', error);
      return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
    }

    return NextResponse.json({ material });
  } catch (error) {
    console.error('Error in materials API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 