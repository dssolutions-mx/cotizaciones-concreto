import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    if (!supabase) {
      console.error('Failed to create Supabase client in POST');
      return NextResponse.json({
        success: false,
        error: 'Error de configuración del servidor'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const materialId = formData.get('material_id') as string;
    const certificateType = formData.get('certificate_type') as string || 'quality_certificate';
    const notes = formData.get('notes') as string || '';

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo es requerido' },
        { status: 400 }
      );
    }

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: 'ID de material es requerido' },
        { status: 400 }
      );
    }

    // Validate file type (only PDFs)
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Solo se permiten archivos PDF' },
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

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 });
    }

    // Only QUALITY_TEAM and EXECUTIVE can upload certificates
    if (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE') {
      return NextResponse.json({ 
        error: 'No tiene permisos para subir certificados. Solo usuarios QUALITY_TEAM o EXECUTIVE.' 
      }, { status: 403 });
    }

    // Verify the material exists
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, material_code, plant_id')
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const plantPath = material.plant_id || 'general';
    const fileName = `${plantPath}/certificates/${materialId}_${timestamp}_${randomString}.pdf`;

    // Upload certificate to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('material-certificates')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: `Error al subir certificado: ${uploadError.message}`
      }, { status: 500 });
    }

    // Insert certificate record into database
    const certificateData = {
      material_id: materialId,
      file_name: fileName,
      original_name: file.name,
      file_path: fileName,
      file_size: file.size,
      certificate_type: certificateType,
      notes: notes || null,
      uploaded_by: user.id
    };

    const { data: certificateRecord, error: insertError } = await supabase
      .from('material_certificates')
      .insert(certificateData)
      .select()
      .single();

    if (insertError) {
      // If database insert fails, clean up the uploaded file
      await supabase.storage
        .from('material-certificates')
        .remove([fileName]);
      
      console.error('Insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: `Error al guardar información del certificado: ${insertError.message}`
      }, { status: 500 });
    }

    // Generate signed URL for the uploaded certificate
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('material-certificates')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    let certificateUrl: string | null = null;
    if (signedUrlError || !signedUrlData.signedUrl) {
      console.warn('Failed to create signed URL:', signedUrlError);
    } else {
      certificateUrl = signedUrlData.signedUrl;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...certificateRecord,
        url: certificateUrl
      },
      message: 'Certificado subido exitosamente',
    });

  } catch (error) {
    console.error('Error in material certificates POST:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    if (!supabase) {
      console.error('Failed to create Supabase client in GET');
      return NextResponse.json({
        success: false,
        error: 'Error de configuración del servidor'
      }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('material_id');

    if (!materialId) {
      return NextResponse.json({
        success: false,
        error: 'material_id es requerido'
      }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get certificates
    const { data: certificates, error: certificatesError } = await supabase
      .from('material_certificates')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });

    if (certificatesError) {
      throw new Error(`Error al obtener certificados: ${certificatesError.message}`);
    }

    // Generate fresh signed URLs for each certificate
    const certificatesWithUrls = await Promise.all(
      (certificates || []).map(async (cert) => {
        try {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('material-certificates')
            .createSignedUrl(cert.file_path, 3600); // 1 hour expiry
          
          if (signedUrlError || !signedUrlData.signedUrl) {
            console.warn(`Failed to generate signed URL for ${cert.file_name}:`, signedUrlError);
            return {
              ...cert,
              url: null
            };
          }

          return {
            ...cert,
            url: signedUrlData.signedUrl
          };
        } catch (error) {
          console.warn(`Error generating signed URL for ${cert.file_name}:`, error);
          return {
            ...cert,
            url: null
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: certificatesWithUrls,
      message: 'Certificados obtenidos exitosamente',
    });

  } catch (error) {
    console.error('Error in material certificates GET:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    if (!supabase) {
      console.error('Failed to create Supabase client in DELETE');
      return NextResponse.json({
        success: false,
        error: 'Error de configuración del servidor'
      }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const certificateId = searchParams.get('id');

    if (!certificateId) {
      return NextResponse.json({
        success: false,
        error: 'ID del certificado es requerido'
      }, { status: 400 });
    }

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 });
    }

    // Only QUALITY_TEAM and EXECUTIVE can delete certificates
    if (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE') {
      return NextResponse.json({ 
        error: 'No tiene permisos para eliminar certificados' 
      }, { status: 403 });
    }

    // Get certificate to get file path
    const { data: certificate, error: certificateError } = await supabase
      .from('material_certificates')
      .select('*')
      .eq('id', certificateId)
      .single();

    if (certificateError || !certificate) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('material-certificates')
      .remove([certificate.file_path]);

    if (storageError) {
      console.warn('Failed to delete file from storage:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('material_certificates')
      .delete()
      .eq('id', certificateId);

    if (deleteError) {
      throw new Error(`Error al eliminar certificado: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Certificado eliminado exitosamente',
    });

  } catch (error) {
    console.error('Error in material certificates DELETE:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

