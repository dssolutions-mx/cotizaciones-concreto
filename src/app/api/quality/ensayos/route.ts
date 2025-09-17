import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';

// Create a Supabase client with the service role key to bypass RLS
const supabaseAdmin = createAdminClientForApi();

export async function POST(request: NextRequest) {
  try {
    // Verify we have real credentials before proceeding
    if (isUsingFallbackEnv) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }
    
    // Get the data from the request
    const data = await request.json();
    
    // Validate required fields
    if (!data.muestra_id || !data.fecha_ensayo || data.carga_kg === undefined || 
        data.resistencia_calculada === undefined || data.porcentaje_cumplimiento === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Format the data for insert
    const ensayoToCreate = {
      muestra_id: data.muestra_id,
      plant_id: data.plant_id || null,
      fecha_ensayo: typeof data.fecha_ensayo === 'string'
        ? data.fecha_ensayo
        : format(data.fecha_ensayo, 'yyyy-MM-dd'),
      hora_ensayo: data.hora_ensayo || null,
      // Persist the exact timestamp and timezone if provided
      fecha_ensayo_ts: data.fecha_ensayo_ts || new Date().toISOString(),
      event_timezone: data.event_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      carga_kg: data.carga_kg,
      resistencia_calculada: data.resistencia_calculada,
      porcentaje_cumplimiento: data.porcentaje_cumplimiento,
      tiempo_desde_carga: data.tiempo_desde_carga || null,
      observaciones: data.observaciones || '',
      created_by: data.created_by
    };

    console.log('Creating ensayo via API:', ensayoToCreate);

    // Use supabaseAdmin to bypass RLS
    const { data: ensayo, error } = await supabaseAdmin
      .from('ensayos')
      .insert(ensayoToCreate)
      .select()
      .single();

    if (error) {
      console.error('Error creating ensayo:', error);
      return NextResponse.json(
        { error: `Error creating ensayo: ${error.message}` },
        { status: 500 }
      );
    }

    // Update the muestra status to ENSAYADO
    const { error: updateError } = await supabaseAdmin
      .from('muestras')
      .update({ estado: 'ENSAYADO', updated_at: new Date().toISOString() })
      .eq('id', data.muestra_id);

    if (updateError) {
      console.error('Error updating muestra status:', updateError);
      // Continue despite error, we'll report this separately
    }

    return NextResponse.json({ ensayo });
  } catch (error) {
    console.error('Unhandled error in ensayos API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 