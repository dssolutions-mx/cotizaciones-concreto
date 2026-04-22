import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canWriteMaterialsCatalog } from '@/lib/auth/materialsCatalogRoles';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
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

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('materials')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting material:', error);
      return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in materials DELETE API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
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

    // Allowlist fields only (mass assignment protection)
    const updatePayload: Record<string, unknown> = {
      material_code: body.material_code,
      material_name: body.material_name,
      category: body.category,
      unit_of_measure: body.unit_of_measure,
      is_active: body.is_active ?? true,
    };
    if ('accounting_code' in body) {
      const ac = body.accounting_code
      if (ac != null && typeof ac !== 'string') {
        return NextResponse.json({ error: 'accounting_code must be a string' }, { status: 400 })
      }
      updatePayload.accounting_code =
        ac == null || String(ac).trim() === '' ? null : String(ac).trim().slice(0, 128)
    }

    // Update material
    const { data: material, error } = await supabase
      .from('materials')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating material:', error);
      return NextResponse.json({ error: 'Failed to update material' }, { status: 500 });
    }

    return NextResponse.json({ material });
  } catch (error) {
    console.error('Error in materials PUT API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 