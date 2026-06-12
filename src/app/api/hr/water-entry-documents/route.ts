import { NextRequest, NextResponse } from 'next/server';
import {
  getHrAuthedContext,
  profileCanAccessPlant,
} from '@/lib/hr/hrRouteAuth';
import { getWaterEntryPlantIdIfAgua } from '@/lib/hr/waterEntries';

export async function GET(request: NextRequest) {
  try {
    const auth = await getHrAuthedContext(request);
    if (!auth.ok) return auth.response;

    const { ctx, supabaseResponse } = auth;
    const entryId = request.nextUrl.searchParams.get('entry_id')?.trim();
    if (!entryId) {
      return NextResponse.json({ error: 'entry_id es requerido' }, { status: 400 });
    }

    const plantId = await getWaterEntryPlantIdIfAgua(ctx.service, entryId);
    if (!plantId) {
      return NextResponse.json({ error: 'Entrada no encontrada o no es agua' }, { status: 404 });
    }

    const allowed = await profileCanAccessPlant(ctx.service, ctx.profile, plantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: documents, error: documentsError } = await ctx.service
      .from('inventory_documents')
      .select('*')
      .eq('entry_id', entryId)
      .eq('document_type', 'entry')
      .order('created_at', { ascending: false });

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    const documentsWithUrls = await Promise.all(
      (documents ?? []).map(async (doc) => {
        try {
          const { data: signedUrlData } = await ctx.service.storage
            .from('inventory-documents')
            .createSignedUrl(doc.file_path, 3600);
          return {
            ...doc,
            url: signedUrlData?.signedUrl ?? null,
          };
        } catch {
          return { ...doc, url: null };
        }
      }),
    );

    const res = NextResponse.json({ success: true, data: documentsWithUrls });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  } catch (err) {
    console.error('GET /api/hr/water-entry-documents:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
