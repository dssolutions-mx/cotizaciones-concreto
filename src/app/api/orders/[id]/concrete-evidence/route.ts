import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sortConcreteRemisionesForAccounting } from '@/lib/remisiones/sortConcreteRemisionesForAccounting';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function canUploadEvidence(profile: { role: string; plant_id: string | null }, orderPlantId: string) {
  if (['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role) && profile.plant_id == null) return true;
  if (['DOSIFICADOR', 'PLANT_MANAGER'].includes(profile.role) && profile.plant_id === orderPlantId) return true;
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: remisionesRaw, error: remErr } = await supabase
      .from('remisiones')
      .select('id, remision_number, fecha, volumen_fabricado, unidad, conductor, tipo_remision')
      .eq('order_id', orderId)
      .eq('tipo_remision', 'CONCRETO')
      .order('fecha', { ascending: true });

    if (remErr) {
      console.error('concrete-evidence GET remisiones:', remErr);
      return NextResponse.json({ error: 'Error al cargar remisiones' }, { status: 500 });
    }

    const concrete_remisiones_ordered = sortConcreteRemisionesForAccounting(
      (remisionesRaw || []).map((r) => ({
        id: r.id,
        remision_number: r.remision_number,
        fecha: r.fecha,
        volumen_fabricado: r.volumen_fabricado,
        unidad: r.unidad,
        conductor: r.conductor,
      }))
    );

    const { data: evidence, error: evErr } = await supabase
      .from('order_concrete_evidence')
      .select('id, file_path, original_name, file_size, mime_type, uploaded_by, notes, created_at, updated_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (evErr) {
      console.error('concrete-evidence GET evidence:', evErr);
      return NextResponse.json({ error: 'Error al cargar evidencia' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        evidence: evidence || null,
        concrete_remisiones_ordered,
      },
    });
  } catch (e) {
    console.error('concrete-evidence GET:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, plant_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (!canUploadEvidence(profile, order.plant_id)) {
      return NextResponse.json({ error: 'No tiene permiso para subir evidencia en este pedido' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: 'Solo se permiten JPEG, PNG o PDF' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo excede el máximo de ${MAX_BYTES / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('order_concrete_evidence')
      .select('id, file_path')
      .eq('order_id', orderId)
      .maybeSingle();

    const plantPath = order.plant_id;
    const ext = file.name.split('.').pop() || 'pdf';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `${plantPath}/order_concrete_evidence/${orderId}/${timestamp}_${randomString}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('remision-documents')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('concrete-evidence storage upload:', uploadError);
      return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 502 });
    }

    const previousPath = existing?.file_path;
    const nowIso = new Date().toISOString();
    const row = {
      file_path: fileName,
      original_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      updated_at: nowIso,
    };

    let saved;
    if (existing?.id) {
      const { data, error: upErr } = await supabase
        .from('order_concrete_evidence')
        .update({
          file_path: row.file_path,
          original_name: row.original_name,
          file_size: row.file_size,
          mime_type: row.mime_type,
          uploaded_by: user.id,
          updated_at: row.updated_at,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (upErr) {
        await supabase.storage.from('remision-documents').remove([fileName]);
        console.error('concrete-evidence update:', upErr);
        return NextResponse.json({ error: 'Error al guardar la evidencia' }, { status: 500 });
      }
      saved = data;
    } else {
      const { data, error: insErr } = await supabase
        .from('order_concrete_evidence')
        .insert({
          order_id: orderId,
          plant_id: order.plant_id,
          file_path: row.file_path,
          original_name: row.original_name,
          file_size: row.file_size,
          mime_type: row.mime_type,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (insErr) {
        await supabase.storage.from('remision-documents').remove([fileName]);
        console.error('concrete-evidence insert:', insErr);
        return NextResponse.json({ error: 'Error al guardar la evidencia' }, { status: 500 });
      }
      saved = data;
    }

    if (previousPath && previousPath !== fileName) {
      await supabase.storage.from('remision-documents').remove([previousPath]);
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (e) {
    console.error('concrete-evidence POST:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, plant_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (!canUploadEvidence(profile, order.plant_id)) {
      return NextResponse.json({ error: 'No tiene permiso' }, { status: 403 });
    }

    const { data: existing, error: findErr } = await supabase
      .from('order_concrete_evidence')
      .select('id, file_path')
      .eq('order_id', orderId)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'No hay evidencia para eliminar' }, { status: 404 });
    }

    await supabase.storage.from('remision-documents').remove([existing.file_path]);

    const { error: delErr } = await supabase.from('order_concrete_evidence').delete().eq('id', existing.id);
    if (delErr) {
      console.error('concrete-evidence delete:', delErr);
      return NextResponse.json({ error: 'Error al eliminar el registro' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('concrete-evidence DELETE:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
