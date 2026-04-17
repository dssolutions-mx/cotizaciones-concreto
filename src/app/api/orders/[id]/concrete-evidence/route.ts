import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sortConcreteRemisionesForAccounting } from '@/lib/remisiones/sortConcreteRemisionesForAccounting';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function normalizeMimeType(mime: string, fileName: string): string {
  const m = (mime || '').trim().toLowerCase();
  if (ALLOWED.has(m)) return m;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return mime || 'application/octet-stream';
}

/** Browsers often send PDF as empty type or octet-stream; accept by extension. */
function isAllowedFile(mime: string, fileName: string): boolean {
  const m = (mime || '').trim().toLowerCase();
  if (ALLOWED.has(m)) return true;
  if (m === 'application/octet-stream' || m === '') {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    return ext === 'pdf' || ext === 'png' || ext === 'jpg' || ext === 'jpeg';
  }
  return false;
}

function expectedStoragePrefix(plantId: string | null, orderId: string): string {
  if (!plantId) return '';
  return `${plantId}/order_concrete_evidence/${orderId}/`;
}

function canUploadEvidence(profile: { role: string; plant_id: string | null }, orderPlantId: string) {
  if (['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role) && profile.plant_id == null) return true;
  if (['DOSIFICADOR', 'PLANT_MANAGER'].includes(profile.role) && profile.plant_id === orderPlantId) return true;
  return false;
}

/** Who may load remisiones + evidence for an order (uploaders, plant, finanzas readers). */
function canReadConcreteEvidence(profile: { role: string; plant_id: string | null }, orderPlantId: string) {
  if (canUploadEvidence(profile, orderPlantId)) return true;
  if (['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role)) {
    if (profile.plant_id == null) return true;
    return profile.plant_id === orderPlantId;
  }
  if (['SALES_AGENT', 'CREDIT_VALIDATOR', 'ADMINISTRATIVE'].includes(profile.role)) {
    if (profile.plant_id == null) return true;
    return profile.plant_id === orderPlantId;
  }
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

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const { data: orderRow, error: orderPeekErr } = await supabase
      .from('orders')
      .select('plant_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderPeekErr || !orderRow?.plant_id) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (!canReadConcreteEvidence(profile, orderRow.plant_id)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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

    let evQuery = supabase
      .from('order_concrete_evidence')
      .select('id, file_path, original_name, file_size, mime_type, uploaded_by, notes, created_at, updated_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (profile.role === 'DOSIFICADOR') {
      evQuery = evQuery.eq('uploaded_by', user.id);
    }

    const { data: evidenceList, error: evErr } = await evQuery;

    if (evErr) {
      console.error('concrete-evidence GET evidence:', evErr);
      return NextResponse.json({ error: 'Error al cargar evidencia' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        evidence: evidenceList || [],
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

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      let body: { file_path?: string; original_name?: string; file_size?: number; mime_type?: string };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
      }

      const filePath = typeof body.file_path === 'string' ? body.file_path.trim() : '';
      const originalName = typeof body.original_name === 'string' ? body.original_name.trim() : '';
      const fileSize = typeof body.file_size === 'number' ? body.file_size : Number.NaN;
      const mimeRaw = typeof body.mime_type === 'string' ? body.mime_type : '';

      if (!filePath || !originalName || !Number.isFinite(fileSize) || fileSize < 1) {
        return NextResponse.json({ error: 'Datos de archivo incompletos' }, { status: 400 });
      }

      if (fileSize > MAX_BYTES) {
        return NextResponse.json(
          { error: `El archivo excede el máximo de ${MAX_BYTES / (1024 * 1024)} MB` },
          { status: 400 }
        );
      }

      const prefix = expectedStoragePrefix(order.plant_id, orderId);
      if (!prefix || !filePath.startsWith(prefix)) {
        return NextResponse.json({ error: 'Ruta de almacenamiento no válida para este pedido' }, { status: 400 });
      }

      const mimeForDb = normalizeMimeType(mimeRaw, originalName);
      if (!isAllowedFile(mimeRaw, originalName)) {
        return NextResponse.json({ error: 'Solo se permiten JPEG, PNG o PDF' }, { status: 400 });
      }

      const { data: saved, error: insErr } = await supabase
        .from('order_concrete_evidence')
        .insert({
          order_id: orderId,
          plant_id: order.plant_id,
          file_path: filePath,
          original_name: originalName,
          file_size: fileSize,
          mime_type: mimeForDb,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insErr) {
        await supabase.storage.from('remision-documents').remove([filePath]);
        console.error('concrete-evidence insert:', insErr);
        return NextResponse.json({ error: 'Error al guardar la evidencia' }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: saved });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    if (!isAllowedFile(file.type, file.name)) {
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

    const { data: savedMultipart, error: insMultipartErr } = await supabase
      .from('order_concrete_evidence')
      .insert({
        order_id: orderId,
        plant_id: order.plant_id,
        file_path: fileName,
        original_name: file.name,
        file_size: file.size,
        mime_type: normalizeMimeType(file.type, file.name),
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insMultipartErr) {
      await supabase.storage.from('remision-documents').remove([fileName]);
      console.error('concrete-evidence insert multipart:', insMultipartErr);
      return NextResponse.json({ error: 'Error al guardar la evidencia' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: savedMultipart });
  } catch (e) {
    console.error('concrete-evidence POST:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const evidenceId = request.nextUrl.searchParams.get('evidence_id');
    if (!evidenceId?.trim()) {
      return NextResponse.json({ error: 'Se requiere evidence_id en la URL' }, { status: 400 });
    }

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
      .select('id, file_path, uploaded_by')
      .eq('id', evidenceId.trim())
      .eq('order_id', orderId)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Evidencia no encontrada' }, { status: 404 });
    }

    if (profile.role === 'DOSIFICADOR' && existing.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'Solo puede eliminar sus propios archivos' }, { status: 403 });
    }

    await supabase.storage.from('remision-documents').remove([existing.file_path]);

    const { error: delErr } = await supabase
      .from('order_concrete_evidence')
      .delete()
      .eq('id', existing.id);
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
