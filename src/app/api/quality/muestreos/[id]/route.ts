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

    // Check if user has permission to delete muestreos
    const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if muestreo exists
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .select('id')
      .eq('id', id)
      .single();

    if (muestreoError || !muestreo) {
      return NextResponse.json({ error: 'Muestreo not found' }, { status: 404 });
    }

    // Check if any muestras have ensayos (prevent deletion if ensayos exist)
    const { data: muestras, error: muestrasError } = await supabase
      .from('muestras')
      .select('id')
      .eq('muestreo_id', id);

    if (muestrasError) {
      console.error('Error checking muestras:', muestrasError);
      return NextResponse.json({ error: 'Failed to check muestras' }, { status: 500 });
    }

    if (muestras && muestras.length > 0) {
      const muestraIds = muestras.map(m => m.id);
      const { data: ensayos, error: ensayosError } = await supabase
        .from('ensayos')
        .select('id')
        .in('muestra_id', muestraIds)
        .limit(1);

      if (ensayosError) {
        console.error('Error checking ensayos:', ensayosError);
        return NextResponse.json({ error: 'Failed to check ensayos' }, { status: 500 });
      }

      if (ensayos && ensayos.length > 0) {
        return NextResponse.json({ 
          error: 'No se puede eliminar el muestreo porque tiene ensayos asociados' 
        }, { status: 400 });
      }
    }

    // Delete muestreo (cascades to muestras and alertas_ensayos via DB constraint)
    const { error: deleteError } = await supabase
      .from('muestreos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting muestreo:', deleteError);
      return NextResponse.json({ error: 'Failed to delete muestreo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in muestreos DELETE API:', error);
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

    // Check if user has permission to update muestreos
    const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate revenimiento_sitio if provided
    if (body.revenimiento_sitio !== undefined) {
      const revenimiento = Number(body.revenimiento_sitio);
      if (isNaN(revenimiento) || revenimiento < 0 || revenimiento > 30) {
        return NextResponse.json({ 
          error: 'Revenimiento debe ser un número entre 0 y 30' 
        }, { status: 400 });
      }
      body.revenimiento_sitio = revenimiento;
    }

    // Prepare update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that are provided and allowed to be updated
    const allowedFields = [
      'revenimiento_sitio',
      'masa_unitaria',
      'temperatura_ambiente',
      'temperatura_concreto',
      'sampling_notes'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        // Round masa_unitaria to nearest integer (no decimals): 23.3 -> 23, 23.5 -> 24
        if (field === 'masa_unitaria' && typeof body[field] === 'number') {
          updateData[field] = Math.round(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    });

    // Update muestreo
    const { data: muestreo, error: updateError } = await supabase
      .from('muestreos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating muestreo:', updateError);
      return NextResponse.json({ error: 'Failed to update muestreo' }, { status: 500 });
    }

    return NextResponse.json({ muestreo });
  } catch (error) {
    console.error('Error in muestreos PUT API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

