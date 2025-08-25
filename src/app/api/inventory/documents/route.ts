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

    // Upload document to storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${profile.plant_id}/${type}/${referenceId}_${Date.now()}.${fileExtension}`;

    const { data, error: uploadError } = await supabase.storage
      .from('inventory-documents')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Error al subir documento: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('inventory-documents')
      .getPublicUrl(data.path);

    const documentUrl = urlData.publicUrl;

    return NextResponse.json({
      success: true,
      data: {
        url: documentUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
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

export async function GET(request: NextRequest) {
  try {
    // This endpoint could be used to list documents for a specific entry/adjustment
    // For now, return a placeholder response
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Funcionalidad de listado de documentos en desarrollo',
    });

  } catch (error) {
    console.error('Error in documents GET:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
