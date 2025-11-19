import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * POST /api/credit-terms/documents/upload
 * Upload a credit document (pagaré, contract, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has permission
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      !profile ||
      !['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS', 'SALES_AGENT'].includes(
        profile.role
      )
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('client_id') as string;
    const documentType = formData.get('document_type') as string;
    const documentAmount = formData.get('document_amount') as string;
    const expiryDate = formData.get('expiry_date') as string;
    const notes = formData.get('notes') as string;

    // Validate required fields
    if (!file || !clientId || !documentType) {
      return NextResponse.json(
        { error: 'file, client_id, and document_type are required' },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ['pagare', 'contract', 'credit_application', 'other'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document_type' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type (PDF, images)
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and images are allowed' },
        { status: 400 }
      );
    }

    // Upload document
    const result = await creditTermsService.uploadCreditDocument(
      file,
      {
        client_id: clientId,
        document_type: documentType as any,
        document_amount: documentAmount ? parseFloat(documentAmount) : undefined,
        expiry_date: expiryDate || undefined,
        notes: notes || undefined,
        uploaded_by: user.id,
      },
      true // use server client
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to upload document' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Document uploaded successfully', data: result.data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error uploading credit document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
