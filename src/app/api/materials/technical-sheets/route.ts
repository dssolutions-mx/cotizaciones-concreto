import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const materialId = formData.get('material_id') as string;
    const notes = formData.get('notes') as string | null;

    if (!file || !materialId) {
      return NextResponse.json({
        success: false,
        error: 'Archivo y material_id son requeridos'
      }, { status: 400 });
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    if (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'No tiene permisos para subir fichas técnicas.' }, { status: 403 });
    }

    // Verify material exists
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, plant_id')
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      return NextResponse.json({
        success: false,
        error: 'Material no encontrado'
      }, { status: 404 });
    }

    // Validate file
    if (file.type !== 'application/pdf') {
      return NextResponse.json({
        success: false,
        error: 'Solo se permiten archivos PDF'
      }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'El archivo excede el tamaño máximo de 10MB'
      }, { status: 400 });
    }

    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const plantFolder = material.plant_id || 'general';
    const fileName = `${plantFolder}/technical_sheets/${materialId}_${timestamp}_${randomString}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('material-certificates')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: `Error al subir ficha técnica: ${uploadError.message}`
      }, { status: 500 });
    }

    // Insert record into database
    const sheetData = {
      material_id: materialId,
      file_name: fileName,
      original_name: file.name,
      file_path: fileName,
      file_size: file.size,
      sheet_type: 'technical_sheet',
      notes: notes || null,
      uploaded_by: user.id
    };

    const { data: sheetRecord, error: insertError } = await supabase
      .from('material_technical_sheets')
      .insert(sheetData)
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('material-certificates')
        .remove([fileName]);
      
      console.error('Insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: `Error al guardar información de la ficha técnica: ${insertError.message}`
      }, { status: 500 });
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('material-certificates')
      .createSignedUrl(fileName, 3600);

    let sheetUrl: string | null = null;
    if (signedUrlError || !signedUrlData.signedUrl) {
      console.warn('Failed to create signed URL:', signedUrlError);
    } else {
      sheetUrl = signedUrlData.signedUrl;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...sheetRecord,
        url: sheetUrl
      },
      message: 'Ficha técnica subida exitosamente',
    });

  } catch (error) {
    console.error('Error in technical sheets POST:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('material_id');

    if (!materialId) {
      return NextResponse.json({
        success: false,
        error: 'material_id es requerido'
      }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get technical sheets
    const { data: sheets, error: sheetsError } = await supabase
      .from('material_technical_sheets')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });

    if (sheetsError) {
      console.error('Error fetching technical sheets:', sheetsError);
      return NextResponse.json({
        success: false,
        error: 'Error al cargar fichas técnicas'
      }, { status: 500 });
    }

    // Generate signed URLs for each sheet
    const sheetsWithUrls = await Promise.all(
      (sheets || []).map(async (sheet) => {
        const { data: signedUrlData } = await supabase.storage
          .from('material-certificates')
          .createSignedUrl(sheet.file_path, 3600);

        return {
          ...sheet,
          url: signedUrlData?.signedUrl || null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: sheetsWithUrls
    });

  } catch (error) {
    console.error('Error in technical sheets GET:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('id');

    if (!sheetId) {
      return NextResponse.json({
        success: false,
        error: 'ID es requerido'
      }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    if (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'No tiene permisos para eliminar fichas técnicas.' }, { status: 403 });
    }

    // Get sheet record
    const { data: sheet, error: fetchError } = await supabase
      .from('material_technical_sheets')
      .select('file_path')
      .eq('id', sheetId)
      .single();

    if (fetchError || !sheet) {
      return NextResponse.json({
        success: false,
        error: 'Ficha técnica no encontrada'
      }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('material-certificates')
      .remove([sheet.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('material_technical_sheets')
      .delete()
      .eq('id', sheetId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Error al eliminar ficha técnica'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Ficha técnica eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error in technical sheets DELETE:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

