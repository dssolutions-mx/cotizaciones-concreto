import { NextRequest, NextResponse } from 'next/server';
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
    
    // Get the form data
    const formData = await request.formData();
    const ensayoId = formData.get('ensayoId') as string;
    const muestraId = formData.get('muestraId') as string;
    const file = formData.get('file') as File;
    
    // Validate required fields
    if (!ensayoId || !muestraId || !file) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upload the file
    const fileName = `${ensayoId}-${file.name}`;
    const { data, error } = await supabaseAdmin.storage
      .from('quality')
      .upload(`evidencias/${muestraId}/${fileName}`, file);

    if (error) {
      console.error('Error uploading file:', error);
      return NextResponse.json(
        { error: `Error uploading file: ${error.message}` },
        { status: 500 }
      );
    }

    // Create an evidencia record
    const { data: evidencia, error: evidenciaError } = await supabaseAdmin
      .from('evidencias')
      .insert({
        ensayo_id: ensayoId,
        path: `evidencias/${muestraId}/${fileName}`,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        tamano_kb: Math.round(file.size / 1024)
      })
      .select()
      .single();

    if (evidenciaError) {
      console.error('Error creating evidencia record:', evidenciaError);
      // We still return success as the file was uploaded
    }

    return NextResponse.json({ 
      success: true, 
      data,
      evidencia: evidencia || null
    });
  } catch (error) {
    console.error('Unhandled error in evidencias API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 