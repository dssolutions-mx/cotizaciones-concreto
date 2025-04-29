import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Create a Supabase client with the service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
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
      fecha_ensayo: typeof data.fecha_ensayo === 'string' 
        ? data.fecha_ensayo 
        : format(data.fecha_ensayo, 'yyyy-MM-dd'),
      carga_kg: data.carga_kg,
      resistencia_calculada: data.resistencia_calculada,
      porcentaje_cumplimiento: data.porcentaje_cumplimiento,
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