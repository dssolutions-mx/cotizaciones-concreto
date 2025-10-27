import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';

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

    // Fetch certificates for these materials (limit to most recent to avoid timeouts)
    const MAX_CERTS_PER_MATERIAL = 3; // Only include 3 most recent certs per material
    const { data: certificates, error: certsError } = await supabase
      .from('material_certificates')
      .select('id, material_id, file_path, original_name, file_name, created_at')
      .in('material_id', materialIds)
      .order('created_at', { ascending: false })
      .limit(50); // Hard limit for safety

    if (certsError) {
      console.error('[Dossier] Certificates query error:', certsError);
      return NextResponse.json({ error: 'Error al obtener certificados' }, { status: 500 });
    }

    if (!certificates || certificates.length === 0) {
      return NextResponse.json({ error: 'No hay certificados para descargar' }, { status: 404 });
    }

    // Group by material and take only most recent per material
    const certsByMaterial = new Map<string, typeof certificates>();
    for (const cert of certificates) {
      if (!certsByMaterial.has(cert.material_id)) {
        certsByMaterial.set(cert.material_id, []);
      }
      const materialCerts = certsByMaterial.get(cert.material_id)!;
      if (materialCerts.length < MAX_CERTS_PER_MATERIAL) {
        materialCerts.push(cert);
      }
    }
    
    // Flatten back to array
    const limitedCertificates = Array.from(certsByMaterial.values()).flat();
    console.log(`[Dossier] Using ${limitedCertificates.length} certificates from ${certificates.length} total`);

    // Map material id -> code for naming inside the ZIP
    const materialCodeById = new Map<string, string>();
    for (const m of materials || []) {
      materialCodeById.set(m.id, m.material_code || m.id);
    }

    // Pre-generate signed URLs and target names, skip failures
    const entries: { url: string; name: string }[] = [];
    for (const cert of limitedCertificates) {
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
        .order('created_at', { ascending: false})
        .limit(10); // Limit plant certs to avoid timeout
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

      // Also include plant verifications in separate folder verificaciones/{plant_code}/...
      const { data: plantVerifications, error: plantVerificationsError } = await supabase
        .from('plant_verifications')
        .select('id, plant_id, file_path, original_name, file_name, created_at')
        .in('plant_id', plantIds)
        .order('created_at', { ascending: false})
        .limit(10); // Limit plant verifications to avoid timeout
      if (plantVerificationsError) {
        console.warn('[Dossier] Plant verifications query error:', plantVerificationsError);
      }

      for (const verification of plantVerifications || []) {
        try {
          const { data: signed, error: signedError } = await supabase
            .storage
            .from('material-certificates')
            .createSignedUrl(verification.file_path, 600);
          if (signedError || !signed?.signedUrl) {
            console.warn('[Dossier] Failed to sign plant verification URL for', verification.file_path, signedError);
            continue;
          }
          const plantCode = codeByPlantId.get(verification.plant_id) || verification.plant_id;
          const folder = `verificaciones/${plantCode}`;
          const base = (verification.original_name || verification.file_name || verification.file_path.split('/').pop() || 'verificacion.pdf')
            .toString()
            .replace(/[\n\r]/g, '')
            .slice(0, 128);
          entries.push({ url: signed.signedUrl, name: `${folder}/${base}` });
        } catch (e) {
          console.warn('[Dossier] Error preparing plant verification entry:', e);
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

    console.log(`[Dossier] Returning ${entries.length} signed URLs for client-side ZIP creation`);

    // Return the list of files with signed URLs for client-side ZIP creation
    return NextResponse.json({
      success: true,
      fileName,
      files: entries
    });
  } catch (error) {
    console.error('[Dossier] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


