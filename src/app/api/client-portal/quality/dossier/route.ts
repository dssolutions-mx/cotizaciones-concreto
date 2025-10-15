import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import archiver from 'archiver';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

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

    // Root-level Dossier de Calidad (outside all folders), if available (from plant_dossiers)
    try {
      let dossierCert: { file_path: string; original_name: string | null; file_name: string | null } | null = null;
      if (plantId && plantId !== 'all') {
        const { data } = await supabase
          .from('plant_dossiers')
          .select('file_path, original_name, file_name')
          .eq('plant_id', plantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) dossierCert = data as any;
      } else if (plantIds.length > 0) {
        const { data } = await supabase
          .from('plant_dossiers')
          .select('file_path, original_name, file_name')
          .in('plant_id', plantIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) dossierCert = data as any;
      }

      if (dossierCert?.file_path) {
        const { data: signedRoot, error: signedRootErr } = await supabase
          .storage
          .from('material-certificates')
          .createSignedUrl(dossierCert.file_path, 600);
        if (!signedRootErr && signedRoot?.signedUrl) {
          const rootName = 'DOSSIER_DE_CALIDAD.pdf';
          entries.unshift({ url: signedRoot.signedUrl, name: rootName });
        }
      }
    } catch (e) {
      console.warn('[Dossier] Failed adding root-level dossier PDF:', e);
    }

    // Download files in parallel batches for speed (max 5 concurrent)
    console.log(`[Dossier] Downloading ${entries.length} files in parallel...`);
    const BATCH_SIZE = 5;
    const buffers: { buffer: Buffer; name: string }[] = [];
    
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const res = await fetch(entry.url);
          if (!res.ok || !res.body) {
            throw new Error(`HTTP ${res.status}`);
          }
          const arrayBuffer = await res.arrayBuffer();
          return { buffer: Buffer.from(arrayBuffer), name: entry.name };
        })
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          buffers.push(result.value);
        } else {
          console.warn('[Dossier] Failed to download:', batch[j].name, result.reason);
        }
      }

      console.log(`[Dossier] Progress: ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
    }

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'No se pudieron descargar certificados' }, { status: 500 });
    }

    console.log(`[Dossier] Creating ZIP with ${buffers.length} files...`);

    // Create archive with lower compression for speed
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    archive.on('warning', (err) => {
      console.warn('[Dossier] Archive warning:', err);
    });
    archive.on('error', (err) => {
      console.error('[Dossier] Archive error:', err);
      throw err;
    });

    // Add all files to archive
    for (const { buffer, name } of buffers) {
      archive.append(buffer, { name });
    }

    // Finalize archive (returns promise)
    const finalizePromise = archive.finalize();

    // Convert archive to Web ReadableStream for Next.js Response
    const nodeStream = archive;
    const webStream = Readable.toWeb(nodeStream as any) as ReadableStream;

    // Wait for finalization to complete
    await finalizePromise;

    console.log(`[Dossier] ZIP stream created successfully with ${buffers.length} files`);

    return new Response(webStream, {
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


