import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const plantId = formData.get('plant_id') as string;
    const notes = (formData.get('notes') as string) || '';
    if (!file) return NextResponse.json({ success: false, error: 'Archivo es requerido' }, { status: 400 });
    if (!plantId) return NextResponse.json({ success: false, error: 'ID de planta es requerido' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ success: false, error: 'Solo se permiten archivos PDF' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ success: false, error: 'El archivo excede el tamaño máximo de 20MB' }, { status: 400 });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE')) {
      return NextResponse.json({ error: 'No tiene permisos para subir dossier' }, { status: 403 });
    }

    const { data: plant, error: plantError } = await supabase.from('plants').select('id').eq('id', plantId).single();
    if (plantError || !plant) return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 });

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `${plant.id}/plant_dossiers/${timestamp}_${randomString}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('material-certificates')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (uploadError) return NextResponse.json({ success: false, error: `Error al subir dossier: ${uploadError.message}` }, { status: 500 });

    const { data: record, error: insertError } = await supabase
      .from('plant_dossiers')
      .insert({
        plant_id: plant.id,
        file_name: fileName,
        original_name: file.name,
        file_path: fileName,
        file_size: file.size,
        notes: notes || null,
        uploaded_by: user.id
      })
      .select()
      .single();
    if (insertError) {
      await supabase.storage.from('material-certificates').remove([fileName]);
      return NextResponse.json({ success: false, error: `Error al guardar información: ${insertError.message}` }, { status: 500 });
    }

    const { data: signed, error: signedErr } = await supabase.storage
      .from('material-certificates')
      .createSignedUrl(fileName, 3600);

    return NextResponse.json({ success: true, data: { ...record, url: signed?.signedUrl || null }, message: 'Dossier de calidad subido exitosamente' });
  } catch (e) {
    console.error('Error in plant dossier POST:', e);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    if (!plantId) return NextResponse.json({ success: false, error: 'plant_id es requerido' }, { status: 400 });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });

    const { data, error } = await supabase
      .from('plant_dossiers')
      .select('*')
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ success: false, error: `Error al obtener dossier: ${error.message}` }, { status: 500 });

    const withUrls = await Promise.all((data || []).map(async (d) => {
      const { data: signed } = await supabase.storage.from('material-certificates').createSignedUrl(d.file_path, 3600);
      return { ...d, url: signed?.signedUrl || null };
    }));
    return NextResponse.json({ success: true, data: withUrls, message: 'Dossier obtenido exitosamente' });
  } catch (e) {
    console.error('Error in plant dossier GET:', e);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE')) {
      return NextResponse.json({ error: 'No tiene permisos para eliminar dossier' }, { status: 403 });
    }

    const { data: dossier, error: dossierErr } = await supabase
      .from('plant_dossiers')
      .select('*')
      .eq('id', id)
      .single();
    if (dossierErr || !dossier) return NextResponse.json({ error: 'Dossier no encontrado' }, { status: 404 });

    await supabase.storage.from('material-certificates').remove([dossier.file_path]);
    const { error: delErr } = await supabase.from('plant_dossiers').delete().eq('id', id);
    if (delErr) return NextResponse.json({ success: false, error: `Error al eliminar dossier: ${delErr.message}` }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Dossier eliminado exitosamente' });
  } catch (e) {
    console.error('Error in plant dossier DELETE:', e);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}


