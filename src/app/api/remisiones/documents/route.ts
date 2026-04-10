import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  REMISION_DOCUMENT_MAX_BYTES,
  REMISION_DOCUMENT_MAX_MB,
} from '@/lib/constants/remisionDocumentsUpload';

/** Map thrown errors to HTTP status + safe client message (full detail stays in logs). */
function clientErrorFromCaughtError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('42501') ||
    (lower.includes('permission denied') && lower.includes('policy'))
  ) {
    return {
      status: 403,
      message: 'No tiene permiso para guardar documentos en esta remisión.',
    };
  }

  if (raw.startsWith('Error al guardar información del documento:')) {
    const tail = raw.slice('Error al guardar información del documento:'.length).trim();
    const tailLower = tail.toLowerCase();
    if (tailLower.includes('row-level') || tailLower.includes('rls') || tailLower.includes('42501')) {
      return {
        status: 403,
        message: 'No tiene permiso para guardar documentos en esta remisión.',
      };
    }
    return {
      status: 400,
      message: 'No se pudo registrar el documento. Verifique permisos o intente de nuevo.',
    };
  }

  if (raw.startsWith('Error al subir documento:')) {
    const tail = raw.slice('Error al subir documento:'.length).trim().toLowerCase();
    if (tail.includes('already exists') || tail.includes('duplicate')) {
      return {
        status: 409,
        message: 'Ya existe un archivo con el mismo nombre en el servidor.',
      };
    }
    return {
      status: 502,
      message: 'Error al almacenar el archivo. Intente de nuevo o use otro formato.',
    };
  }

  return { status: 500, message: 'Error interno del servidor' };
}

/** Large PDFs may need more time to stream to Supabase */
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const remisionId = formData.get('remision_id') as string;
    const documentType = formData.get('document_type') as string;
    const documentCategory = formData.get('document_category') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo es requerido' },
        { status: 400 }
      );
    }

    if (!documentType || !['remision_proof', 'delivery_evidence', 'quality_check', 'additional'].includes(documentType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento inválido' },
        { status: 400 }
      );
    }

    if (!documentCategory || !['concrete_remision', 'pumping_remision', 'general'].includes(documentCategory)) {
      return NextResponse.json(
        { success: false, error: 'Categoría de documento inválida' },
        { status: 400 }
      );
    }

    if (!remisionId) {
      return NextResponse.json(
        { success: false, error: 'ID de remisión es requerido' },
        { status: 400 }
      );
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no permitido. Solo se permiten: JPEG, PNG, PDF, CSV' },
        { status: 400 }
      );
    }

    if (file.size > REMISION_DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `El archivo excede el tamaño máximo de ${REMISION_DOCUMENT_MAX_MB}MB por archivo.`,
        },
        { status: 400 }
      );
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check plant access
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 });
    }

    // Verify the remision exists and get its plant_id (RLS policies will handle access control)
    const { data: remision, error: remisionError } = await supabase
      .from('remisiones')
      .select('id, plant_id')
      .eq('id', remisionId)
      .single();

    if (remisionError || !remision) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 });
    }

    // Generate unique filename using the remision's plant_id
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    
    // Use the plant where the remision belongs (not the user's plant)
    const plantPath = remision.plant_id ? remision.plant_id.toString() : 'general';
    const fileName = `${plantPath}/${documentCategory}/${remisionId}_${timestamp}_${randomString}.${fileExtension}`;

    // Upload document to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('remision-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Error al subir documento: ${uploadError.message}`);
    }

    // We'll set the permanent URL after inserting the record

    // Insert document record into database
    const documentData = {
      remision_id: remisionId,
      file_name: fileName,
      original_name: file.name,
      file_path: fileName,
      file_size: file.size,
      mime_type: file.type,
      document_type: documentType,
      document_category: documentCategory,
      uploaded_by: user.id
    };

    const { data: documentRecord, error: insertError } = await supabase
      .from('remision_documents')
      .insert(documentData)
      .select()
      .single();

    if (insertError) {
      // If database insert fails, clean up the uploaded file
      await supabase.storage
        .from('remision-documents')
        .remove([fileName]);
      
      throw new Error(`Error al guardar información del documento: ${insertError.message}`);
    }

    // Generate signed URL for the uploaded document (Supabase best practice)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('remision-documents')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    let documentUrl: string | null = null;
    if (signedUrlError || !signedUrlData.signedUrl) {
      console.warn('Failed to create signed URL for uploaded document:', signedUrlError);
    } else {
      documentUrl = signedUrlData.signedUrl;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...documentRecord,
        url: documentUrl
      },
      message: 'Documento subido exitosamente',
    });

  } catch (error) {
    console.error('Error in remision documents POST:', error);
    const { status, message } = clientErrorFromCaughtError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const remisionId = searchParams.get('remision_id');
    const documentCategory = searchParams.get('document_category'); // Optional filter

    if (!remisionId) {
      return NextResponse.json({
        success: false,
        error: 'remision_id es requerido'
      }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from('remision_documents')
      .select('*')
      .eq('remision_id', remisionId)
      .order('created_at', { ascending: false });

    // Apply category filter if provided
    if (documentCategory) {
      query = query.eq('document_category', documentCategory);
    }

    const { data: documents, error: documentsError } = await query;

    if (documentsError) {
      throw new Error(`Error al obtener documentos: ${documentsError.message}`);
    }

    // Generate fresh signed URLs for each document (Supabase best practice)
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('remision-documents')
            .createSignedUrl(doc.file_path, 3600); // 1 hour expiry for viewing
          
          if (signedUrlError || !signedUrlData.signedUrl) {
            console.warn(`Failed to generate signed URL for ${doc.file_name}:`, signedUrlError);
            return {
              ...doc,
              url: null
            };
          }

          return {
            ...doc,
            url: signedUrlData.signedUrl
          };
        } catch (error) {
          console.warn(`Error generating signed URL for ${doc.file_name}:`, error);
          return {
            ...doc,
            url: null
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: documentsWithUrls,
      message: 'Documentos obtenidos exitosamente',
    });

  } catch (error) {
    console.error('Error in remision documents GET:', error);
    const { status, message } = clientErrorFromCaughtError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: 'ID del documento es requerido'
      }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get document to check ownership and get file path
    const { data: document, error: documentError } = await supabase
      .from('remision_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('remision-documents')
      .remove([document.file_path]);

    if (storageError) {
      console.warn('Failed to delete file from storage:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('remision_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      throw new Error(`Error al eliminar documento: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Documento eliminado exitosamente',
    });

  } catch (error) {
    console.error('Error in remision documents DELETE:', error);
    const { status, message } = clientErrorFromCaughtError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
