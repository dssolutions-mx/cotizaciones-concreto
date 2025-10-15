import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const plantId = formData.get('plant_id') as string;
    const certificateType = (formData.get('certificate_type') as string) || 'plant_certificate';
    const notes = (formData.get('notes') as string) || '';
    const validFrom = (formData.get('valid_from') as string) || '';
    const validTo = (formData.get('valid_to') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Archivo es requerido' }, { status: 400 });
    }
    if (!plantId) {
      return NextResponse.json({ success: false, error: 'ID de planta es requerido' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Solo se permiten archivos PDF' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'El archivo excede el tamaño máximo de 10MB' }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 });
    }
    if (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'No tiene permisos para subir certificados.' }, { status: 403 });
    }

    // Verify plant
    const { data: plant, error: plantError } = await supabase
      .from('plants')
      .select('id, code')
      .eq('id', plantId)
      .single();
    if (plantError || !plant) {
      return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `${plant.id}/plant_certificates/${timestamp}_${randomString}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('material-certificates')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      return NextResponse.json({ success: false, error: `Error al subir certificado: ${uploadError.message}` }, { status: 500 });
    }

    const insertData: any = {
      plant_id: plant.id,
      file_name: fileName,
      original_name: file.name,
      file_path: fileName,
      file_size: file.size,
      certificate_type: certificateType,
      notes: notes || null,
      uploaded_by: user.id,
    };
    if (validFrom) insertData.valid_from = validFrom;
    if (validTo) insertData.valid_to = validTo;

    const { data: certRecord, error: insertError } = await supabase
      .from('plant_certificates')
      .insert(insertData)
      .select()
      .single();
    if (insertError) {
      await supabase.storage.from('material-certificates').remove([fileName]);
      return NextResponse.json({ success: false, error: `Error al guardar información: ${insertError.message}` }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('material-certificates')
      .createSignedUrl(fileName, 3600);
    return NextResponse.json({
      success: true,
      data: { ...certRecord, url: signedUrlData?.signedUrl || null },
      message: 'Certificado de planta subido exitosamente',
    });
  } catch (error) {
    console.error('Error in plant certificates POST:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    if (!plantId) {
      return NextResponse.json({ success: false, error: 'plant_id es requerido' }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: certs, error } = await supabase
      .from('plant_certificates')
      .select('*')
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ success: false, error: `Error al obtener certificados: ${error.message}` }, { status: 500 });
    }

    const withUrls = await Promise.all((certs || []).map(async (c) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from('material-certificates')
        .createSignedUrl(c.file_path, 3600);
      return { ...c, url: signed?.signedUrl || null };
    }));

    return NextResponse.json({ success: true, data: withUrls, message: 'Certificados obtenidos exitosamente' });
  } catch (error) {
    console.error('Error in plant certificates GET:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID del certificado es requerido' }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE')) {
      return NextResponse.json({ error: 'No tiene permisos para eliminar certificados' }, { status: 403 });
    }

    const { data: cert, error: certError } = await supabase
      .from('plant_certificates')
      .select('*')
      .eq('id', id)
      .single();
    if (certError || !cert) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 });
    }

    const { error: delFileErr } = await supabase.storage
      .from('material-certificates')
      .remove([cert.file_path]);
    if (delFileErr) {
      console.warn('Failed to delete storage file:', delFileErr);
    }

    const { error: delErr } = await supabase
      .from('plant_certificates')
      .delete()
      .eq('id', id);
    if (delErr) {
      return NextResponse.json({ success: false, error: `Error al eliminar certificado: ${delErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Certificado eliminado exitosamente' });
  } catch (error) {
    console.error('Error in plant certificates DELETE:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}


