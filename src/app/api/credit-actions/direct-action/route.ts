import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    // Get parameters from the URL
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order');
    const action = searchParams.get('action');
    const email = searchParams.get('email');

    if (!orderId || !action || !email) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lookup the stored token for this order and email
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('credit_action_tokens')
      .select('*')
      .eq('order_id', orderId)
      .eq('recipient_email', email)
      .single();

    if (tokenError || !tokenRecord) {
      console.error('Token lookup error:', tokenError || 'Token not found');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?action=error`);
    }

    // Get the appropriate token based on the action
    const token = action === 'approve' ? tokenRecord.approve_token : 
                 (action === 'reject' ? tokenRecord.reject_token : null);

    if (!token) {
      console.error('Invalid action or token not found for action:', action);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?action=error`);
    }

    // Redirect to the process endpoint with the token
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/credit-actions/process?token=${token}`
    );
  } catch (error) {
    console.error('Error processing direct action:', error);
    // Use a fallback orderId for the redirect if we can't extract it from the request
    const fallbackOrderId = new URL(request.url).searchParams.get('order') || 'error';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orders/${fallbackOrderId}?action=error`);
  }
} 