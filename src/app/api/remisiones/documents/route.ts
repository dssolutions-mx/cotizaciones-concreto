import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el tamaño máximo de 10MB' },
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

    // Verify the remision exists (RLS policies will handle access control)
    const { data: remision, error: remisionError } = await supabase
      .from('remisiones')
      .select('id, plant_id')
      .eq('id', remisionId)
      .single();

    if (remisionError || !remision) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${profile.plant_id}/${documentCategory}/${remisionId}_${timestamp}_${randomString}.${fileExtension}`;

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

    // Generate permanent URL for the uploaded document
    const permanentUrl = `/api/remisiones/documents/${documentRecord.id}/view`;

    return NextResponse.json({
      success: true,
      data: {
        ...documentRecord,
        url: permanentUrl
      },
      message: 'Documento subido exitosamente',
    });

  } catch (error) {
    console.error('Error in remision documents POST:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
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

    // Generate permanent document URLs that never expire
    const documentsWithUrls = documents.map((doc) => {
      // Use permanent viewing endpoint instead of expiring signed URLs
      const permanentUrl = `/api/remisiones/documents/${doc.id}/view`;
      
      return {
        ...doc,
        url: permanentUrl
      };
    });

    return NextResponse.json({
      success: true,
      data: documentsWithUrls,
      message: 'Documentos obtenidos exitosamente',
    });

  } catch (error) {
    console.error('Error in remision documents GET:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
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
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
