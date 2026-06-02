import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadMuestreoDetailBundle } from '@/services/muestreoDetailService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
const WRITE_ROLES = [...READ_ROLES, 'ADMIN', 'ADMIN_OPERATIONS'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !READ_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE });
    }

    const bundle = await loadMuestreoDetailBundle(id);
    return NextResponse.json({ data: bundle }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Muestreo not found' ? 404 : 500;
    console.error('Error in muestreos GET API:', error);
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
}

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
    if (!WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { data: existing, error: existingError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, hora_muestreo, event_timezone')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Muestreo not found' }, { status: 404 });
    }
    
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

    // Validate contenido_aire if provided (optional, 0–100%)
    if (body.contenido_aire !== undefined && body.contenido_aire !== null) {
      const ca = Number(body.contenido_aire);
      if (isNaN(ca) || ca < 0 || ca > 100) {
        return NextResponse.json({
          error: 'Contenido de aire debe ser un número entre 0 y 100',
        }, { status: 400 });
      }
      body.contenido_aire = ca;
    }

    // Prepare update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    const allowedFields = [
      'revenimiento_sitio',
      'masa_unitaria',
      'temperatura_ambiente',
      'temperatura_concreto',
      'contenido_aire',
      'sampling_notes',
      'manual_reference',
    ] as const;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'masa_unitaria' && typeof body[field] === 'number') {
          updateData[field] = Math.round(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (body.plant_id !== undefined) {
      const plantId = String(body.plant_id);
      const { data: plant, error: plantError } = await supabase
        .from('plants')
        .select('id, code')
        .eq('id', plantId)
        .eq('is_active', true)
        .single();

      if (plantError || !plant) {
        return NextResponse.json({ error: 'Planta no válida o inactiva' }, { status: 400 });
      }

      updateData.plant_id = plant.id;
      updateData.planta = plant.code;
    }

    const fechaProvided = body.fecha_muestreo !== undefined;
    const horaProvided = body.hora_muestreo !== undefined;
    if (fechaProvided || horaProvided) {
      const fecha = fechaProvided ? String(body.fecha_muestreo) : existing.fecha_muestreo;
      const horaRaw = horaProvided ? String(body.hora_muestreo) : existing.hora_muestreo ?? '12:00:00';
      const hora = horaRaw.length === 5 ? `${horaRaw}:00` : horaRaw;
      const [y, m, d] = fecha.split('-').map((n: string) => parseInt(n, 10));
      const [hh, mm, ss] = hora.split(':').map((n: string) => parseInt(n, 10));
      if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) {
        return NextResponse.json({ error: 'Fecha u hora de muestreo no válida' }, { status: 400 });
      }
      const ts = new Date(y, m - 1, d, hh, mm, Number.isNaN(ss) ? 0 : ss);
      updateData.fecha_muestreo = fecha;
      updateData.hora_muestreo = hora;
      updateData.fecha_muestreo_ts = ts.toISOString();
    }

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

    if (updateData.plant_id) {
      const { error: muestrasError } = await supabase
        .from('muestras')
        .update({ plant_id: updateData.plant_id })
        .eq('muestreo_id', id);

      if (muestrasError) {
        console.error('Error updating muestras plant_id:', muestrasError);
        return NextResponse.json({ error: 'Muestreo guardado pero falló actualizar muestras' }, { status: 500 });
      }

      const { data: muestraRows } = await supabase.from('muestras').select('id').eq('muestreo_id', id);
      const muestraIds = (muestraRows ?? []).map((r) => r.id);
      if (muestraIds.length > 0) {
        const { error: ensayosError } = await supabase
          .from('ensayos')
          .update({ plant_id: updateData.plant_id })
          .in('muestra_id', muestraIds);

        if (ensayosError) {
          console.error('Error updating ensayos plant_id:', ensayosError);
          return NextResponse.json({ error: 'Muestreo guardado pero falló actualizar ensayos' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ muestreo });
  } catch (error) {
    console.error('Error in muestreos PUT API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

