import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const referenceId = formData.get('reference_id') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo es requerido' },
        { status: 400 }
      );
    }

    if (!type || !['entry', 'adjustment'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento debe ser "entry" o "adjustment"' },
        { status: 400 }
      );
    }

    if (!referenceId) {
      return NextResponse.json(
        { success: false, error: 'ID de referencia es requerido' },
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

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    // Verify the reference exists and user has access
    let hasAccess = false;
    if (type === 'entry') {
      const { data: entry } = await supabase
        .from('material_entries')
        .select('plant_id')
        .eq('id', referenceId)
        .single();
      
      if (entry) {
        hasAccess = profile.role === 'EXECUTIVE' || 
                   profile.plant_id === entry.plant_id ||
                   (profile.business_unit_id && await checkBusinessUnitAccess(supabase, profile.business_unit_id, entry.plant_id));
      }
    } else if (type === 'adjustment') {
      const { data: adjustment } = await supabase
        .from('material_adjustments')
        .select('plant_id')
        .eq('id', referenceId)
        .single();
      
      if (adjustment) {
        hasAccess = profile.role === 'EXECUTIVE' || 
                   profile.plant_id === adjustment.plant_id ||
                   (profile.business_unit_id && await checkBusinessUnitAccess(supabase, profile.business_unit_id, adjustment.plant_id));
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin acceso a la entrada o ajuste especificado' }, { status: 403 });
    }

    // Create organized file path structure
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().split('-')[0]; // Short unique identifier
    const fileName = `${type}/${referenceId}/${timestamp}_${uniqueId}.${fileExtension}`;

    // Upload document to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('inventory-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Error al subir documento: ${uploadError.message}`);
    }

    // Create signed URL that expires in 1 year (maximum allowed by Supabase)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('inventory-documents')
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (signedUrlError) {
      // If signed URL fails, fall back to public URL but log the issue
      console.warn('Failed to create signed URL, using public URL:', signedUrlError);
      const { data: urlData } = supabase.storage
        .from('inventory-documents')
        .getPublicUrl(fileName);
      var documentUrl = urlData.publicUrl;
    } else {
      var documentUrl = signedUrlData.signedUrl;
    }

    // Insert document record into database
    const documentData = {
      entry_id: type === 'entry' ? referenceId : null,
      adjustment_id: type === 'adjustment' ? referenceId : null,
      file_name: fileName,
      original_name: file.name,
      file_path: fileName,
      file_size: file.size,
      mime_type: file.type,
      document_type: type,
      uploaded_by: user.id
    };

    const { data: documentRecord, error: insertError } = await supabase
      .from('inventory_documents')
      .insert(documentData)
      .select()
      .single();

    if (insertError) {
      // If database insert fails, clean up the uploaded file
      await supabase.storage
        .from('inventory-documents')
        .remove([fileName]);
      
      throw new Error(`Error al guardar documento en base de datos: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: documentRecord.id,
        url: documentUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType: type,
        referenceId: referenceId,
        uploadedAt: documentRecord.created_at
      },
      message: 'Documento subido exitosamente',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in documents POST:', error);
    
    if (error instanceof Error) {
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // Check for storage errors
      if (error.message.includes('storage') || error.message.includes('upload')) {
        return NextResponse.json(
          { success: false, error: 'Error al subir el archivo al almacenamiento' },
          { status: 500 }
        );
      }

      // Check for quota exceeded errors
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return NextResponse.json(
          { success: false, error: 'Límite de almacenamiento excedido' },
          { status: 507 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Helper function to check business unit access
async function checkBusinessUnitAccess(supabase: any, businessUnitId: string, plantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('plants')
    .select('id')
    .eq('id', plantId)
    .eq('business_unit_id', businessUnitId)
    .single();
  
  return !!data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get('reference_id');
    const type = searchParams.get('type');

    if (!referenceId || !type) {
      return NextResponse.json({
        success: false,
        error: 'reference_id y type son requeridos'
      }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get documents for the specified reference
    const { data: documents, error: documentsError } = await supabase
      .from('inventory_documents')
      .select('*')
      .eq(type === 'entry' ? 'entry_id' : 'adjustment_id', referenceId)
      .eq('document_type', type)
      .order('created_at', { ascending: false });

    if (documentsError) {
      throw new Error(`Error al obtener documentos: ${documentsError.message}`);
    }

    // Generate fresh signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const { data: signedUrlData } = await supabase.storage
            .from('inventory-documents')
            .createSignedUrl(doc.file_path, 3600); // 1 hour expiry for viewing
          
          return {
            ...doc,
            url: signedUrlData?.signedUrl || null
          };
        } catch (error) {
          console.warn(`Failed to generate signed URL for ${doc.file_name}:`, error);
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
    console.error('Error in documents GET:', error);
    
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
      .from('inventory_documents')
      .select('*')
      .eq('id', documentId)
      .eq('uploaded_by', user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Documento no encontrado o sin permisos' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('inventory-documents')
      .remove([document.file_path]);

    if (storageError) {
      console.warn('Failed to delete file from storage:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('inventory_documents')
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
    console.error('Error in documents DELETE:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
