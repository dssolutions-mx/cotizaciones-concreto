import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const formData = await request.formData();
    const file = formData.get('arkik_file') as File;
    const plantId = formData.get('plant_id') as string;
    const date = formData.get('date') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo Arkik es requerido' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no válido. Solo se permiten archivos CSV, XLS y XLSX' },
        { status: 400 }
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB for Arkik files
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el tamaño máximo de 50MB' },
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
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 401 });
    }

    // Process Arkik file upload (placeholder for integration)
    const result = {
      fileId: 'temp-' + Date.now(),
      totalRecords: 0,
      date: plantId || new Date().toISOString().split('T')[0],
      plant: profile.plant_id || 'unknown',
      status: 'uploaded',
    };

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Archivo Arkik subido exitosamente. Procesamiento en curso.',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in arkik-upload POST:', error);
    
    if (error instanceof Error) {
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // Check for file processing errors
      if (error.message.includes('processing') || error.message.includes('parse')) {
        return NextResponse.json(
          { success: false, error: 'Error al procesar el archivo Arkik. Verifique el formato.' },
          { status: 400 }
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
