import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Resolve client for naming the file (optional)
    const { data: client } = await supabase
      .from('clients')
      .select('business_name, client_code')
      .eq('portal_user_id', user.id)
      .maybeSingle();

    const today = new Date();
    const y = String(today.getFullYear());
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const safeName = (client?.client_code || client?.business_name || 'cliente')
      .toString()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40);
    const fileName = `dossier_calidad_${safeName}_${y}${m}${d}.zip`;

    // Fetch materials visible to this user (RLS applies), optionally filtered by plant
    let materialsQuery = supabase
      .from('materials')
      .select('id, material_code, material_name, plant_id')
      .eq('is_active', true)
      .order('material_name');

    if (plantId && plantId !== 'all') {
      materialsQuery = materialsQuery.eq('plant_id', plantId);
    }

    const { data: materials, error: materialsError } = await materialsQuery;
    if (materialsError) {
      console.error('[Dossier] Materials query error:', materialsError);
      return NextResponse.json({ error: 'Error al obtener materiales' }, { status: 500 });
    }

    const materialIds = (materials || []).map(m => m.id);
    if (materialIds.length === 0) {
      return NextResponse.json({ error: 'No hay materiales disponibles' }, { status: 404 });
    }

    // Fetch certificates for these materials
    const { data: certificates, error: certsError } = await supabase
      .from('material_certificates')
      .select('id, material_id, file_path, original_name, file_name, created_at')
      .in('material_id', materialIds)
      .order('created_at', { ascending: false });

    if (certsError) {
      console.error('[Dossier] Certificates query error:', certsError);
      return NextResponse.json({ error: 'Error al obtener certificados' }, { status: 500 });
    }

    if (!certificates || certificates.length === 0) {
      return NextResponse.json({ error: 'No hay certificados para descargar' }, { status: 404 });
    }

    // Map material id -> code for naming inside the ZIP
    const materialCodeById = new Map<string, string>();
    for (const m of materials || []) {
      materialCodeById.set(m.id, m.material_code || m.id);
    }

    // Pre-generate signed URLs and target names, skip failures
    const entries: { url: string; name: string }[] = [];
    for (const cert of certificates) {
      try {
        const { data: signed, error: signedError } = await supabase
          .storage
          .from('material-certificates')
          .createSignedUrl(cert.file_path, 600);

        if (signedError || !signed?.signedUrl) {
          console.warn('[Dossier] Failed to sign URL for', cert.file_path, signedError);
          continue;
        }

        const folder = `certificados/${materialCodeById.get(cert.material_id) || cert.material_id}`;
        const base = (cert.original_name || cert.file_name || cert.file_path.split('/').pop() || 'certificado.pdf')
          .toString()
          .replace(/[\n\r]/g, '')
          .slice(0, 128);
        entries.push({ url: signed.signedUrl, name: `${folder}/${base}` });
      } catch (e) {
        console.warn('[Dossier] Error preparing certificate entry:', e);
      }
    }

    // Also include plant certificates in separate folder certificados_de_planta/{plant_code}/...
    const plantIdsSet = new Set<string>((materials || []).map(m => m.plant_id).filter(Boolean) as string[]);
    const plantIds = Array.from(plantIdsSet);
    if (plantIds.length > 0) {
      const { data: plants, error: plantsError } = await supabase
        .from('plants')
        .select('id, code')
        .in('id', plantIds);
      if (plantsError) {
        console.warn('[Dossier] Plants query error:', plantsError);
      }

      const codeByPlantId = new Map<string, string>();
      for (const p of plants || []) codeByPlantId.set(p.id, p.code);

      const { data: plantCerts, error: plantCertsError } = await supabase
        .from('plant_certificates')
        .select('id, plant_id, file_path, original_name, file_name, created_at')
        .in('plant_id', plantIds)
        .order('created_at', { ascending: false });
      if (plantCertsError) {
        console.warn('[Dossier] Plant certificates query error:', plantCertsError);
      }

      for (const cert of plantCerts || []) {
        try {
          const { data: signed, error: signedError } = await supabase
            .storage
            .from('material-certificates')
            .createSignedUrl(cert.file_path, 600);
          if (signedError || !signed?.signedUrl) {
            console.warn('[Dossier] Failed to sign plant certificate URL for', cert.file_path, signedError);
            continue;
          }
          const plantCode = codeByPlantId.get(cert.plant_id) || cert.plant_id;
          const folder = `certificados_de_planta/${plantCode}`;
          const base = (cert.original_name || cert.file_name || cert.file_path.split('/').pop() || 'certificado.pdf')
            .toString()
            .replace(/[\n\r]/g, '')
            .slice(0, 128);
          entries.push({ url: signed.signedUrl, name: `${folder}/${base}` });
        } catch (e) {
          console.warn('[Dossier] Error preparing plant certificate entry:', e);
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No fue posible preparar certificados para descarga' }, { status: 404 });
    }

    // Create archive and stream it to the client
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.on('warning', (err) => {
      console.warn('[Dossier] Archive warning:', err);
    });
    archive.on('error', (err) => {
      console.error('[Dossier] Archive error:', err);
      stream.destroy(err);
    });

    // Start appending files sequentially to control memory/FD usage
    (async () => {
      for (const entry of entries) {
        try {
          const res = await fetch(entry.url);
          if (!res.ok || !res.body) {
            console.warn('[Dossier] Skipping file due to fetch error:', entry.name, res.status);
            continue;
          }
          // Append the web ReadableStream by converting to Node stream via Readable.fromWeb if available
          // @ts-ignore - Node 18+ provides fromWeb
          const nodeStream = (res.body as any).getReader ? (await import('stream')).Readable.fromWeb(res.body as any) : (res as any).body;
          archive.append(nodeStream as any, { name: entry.name });
        } catch (e) {
          console.warn('[Dossier] Error appending file:', entry.name, e);
        }
      }
      archive.finalize();
    })();

    archive.pipe(stream);

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error('[Dossier] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


