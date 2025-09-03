import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json({ error: 'ID del documento es requerido' }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get document with remision information (RLS policies will enforce access control)
    const { data: document, error: documentError } = await supabase
      .from('remision_documents')
      .select(`
        *,
        remisiones!inner(
          id,
          plant_id,
          remision_number
        )
      `)
      .eq('id', documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Documento no encontrado o sin permisos' }, { status: 404 });
    }

    // Generate a fresh signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('remision-documents')
      .createSignedUrl(document.file_path, 3600); // 1 hour

    if (signedUrlError || !signedUrlData.signedUrl) {
      // Fallback: try to get public URL (though bucket is private)
      console.warn('Failed to create signed URL:', signedUrlError);
      return NextResponse.json({ error: 'No se pudo generar enlace de acceso al documento' }, { status: 500 });
    }

    // Set appropriate headers for the file
    const headers = new Headers();
    headers.set('Content-Type', document.mime_type || 'application/octet-stream');
    headers.set('Content-Disposition', `inline; filename="${document.original_name}"`);
    
    // Option 1: Redirect to the signed URL (recommended for most cases)
    return NextResponse.redirect(signedUrlData.signedUrl);

    // Option 2: Alternative - Proxy the file content (uncomment if you prefer)
    /*
    const fileResponse = await fetch(signedUrlData.signedUrl);
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Error al acceder al archivo' }, { status: 500 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${document.original_name}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });
    */

  } catch (error) {
    console.error('Error in document view endpoint:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
