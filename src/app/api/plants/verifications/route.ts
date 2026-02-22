import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/plants/verifications?plant_id=<uuid>
 * Returns all verifications for a given plant
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id is required' }, { status: 400 });
    }

    const { data: verifications, error } = await supabase
      .from('plant_verifications')
      .select('*')
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching plant verifications:', error);
      return NextResponse.json({ error: 'Error fetching verifications' }, { status: 500 });
    }

    // Generate signed URLs for each verification
    const verificationsWithUrls = await Promise.all(
      (verifications || []).map(async (verification) => {
        try {
          const { data: signedUrl } = await supabase.storage
            .from('material-certificates')
            .createSignedUrl(verification.file_path, 3600);

          return {
            ...verification,
            url: signedUrl?.signedUrl || null,
          };
        } catch (e) {
          console.warn('Failed to generate signed URL for verification:', verification.id, e);
          return {
            ...verification,
            url: null,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: verificationsWithUrls,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/plants/verifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/plants/verifications
 * Uploads a new verification PDF
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const plantId = formData.get('plant_id') as string;
    const notes = formData.get('notes') as string | null;

    if (!file || !plantId) {
      return NextResponse.json({ error: 'file and plant_id are required' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 });
    }

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `verifications/${plantId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('material-certificates')
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading verification to storage:', uploadError);
      return NextResponse.json({ error: 'Error uploading file to storage' }, { status: 500 });
    }

    // Insert record into database
    const { data: verification, error: dbError } = await supabase
      .from('plant_verifications')
      .insert({
        plant_id: plantId,
        file_name: fileName,
        original_name: file.name,
        file_path: filePath,
        file_size: file.size,
        notes: notes || null,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error inserting verification record:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('material-certificates').remove([filePath]);
      return NextResponse.json({ error: 'Error saving verification record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verificación subida exitosamente',
      data: verification,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/plants/verifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/plants/verifications?id=<uuid>
 * Deletes a verification
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    const verificationId = searchParams.get('id');

    if (!verificationId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the verification to find file path
    const { data: verification, error: fetchError } = await supabase
      .from('plant_verifications')
      .select('file_path')
      .eq('id', verificationId)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('material-certificates')
      .remove([verification.file_path]);

    if (storageError) {
      console.warn('Error deleting file from storage:', storageError);
      // Continue anyway to delete database record
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('plant_verifications')
      .delete()
      .eq('id', verificationId);

    if (dbError) {
      console.error('Error deleting verification record:', dbError);
      return NextResponse.json({ error: 'Error deleting verification' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verificación eliminada exitosamente',
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/plants/verifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


