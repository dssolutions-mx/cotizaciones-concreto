import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

    // Check if user has permission to delete muestras
    const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if muestra exists
    const { data: muestra, error: muestraError } = await supabase
      .from('muestras')
      .select('id')
      .eq('id', id)
      .single();

    if (muestraError || !muestra) {
      return NextResponse.json({ error: 'Muestra not found' }, { status: 404 });
    }

    // Check if muestra has ensayos (prevent deletion if ensayos exist)
    const { data: ensayos, error: ensayosError } = await supabase
      .from('ensayos')
      .select('id')
      .eq('muestra_id', id)
      .limit(1);

    if (ensayosError) {
      console.error('Error checking ensayos:', ensayosError);
      return NextResponse.json({ error: 'Failed to check ensayos' }, { status: 500 });
    }

    if (ensayos && ensayos.length > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar la muestra porque tiene ensayos asociados' 
      }, { status: 400 });
    }

    // Delete alertas_ensayos first (they reference muestra_id)
    const { error: alertasError } = await supabase
      .from('alertas_ensayos')
      .delete()
      .eq('muestra_id', id);

    if (alertasError) {
      console.error('Error deleting alertas_ensayos:', alertasError);
      // Continue with muestra deletion even if alertas deletion fails
    }

    // Delete muestra
    const { error: deleteError } = await supabase
      .from('muestras')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting muestra:', deleteError);
      return NextResponse.json({ error: 'Failed to delete muestra' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in muestras DELETE API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

