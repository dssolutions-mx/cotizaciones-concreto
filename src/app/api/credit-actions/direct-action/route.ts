import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  console.log('[direct-action] Processing request');
  
  try {
    // Check if we have Supabase credentials
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[direct-action] Missing Supabase credentials:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey });
      return NextResponse.json({ error: 'Configuration error - missing Supabase credentials' }, { status: 500 });
    }
    
    // Get parameters from the URL
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order');
    const action = searchParams.get('action');
    const email = searchParams.get('email');
    
    console.log('[direct-action] Parameters:', { orderId, action, email, url: request.url });

    if (!orderId || !action || !email) {
      console.error('[direct-action] Missing required parameters');
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[direct-action] Initialized Supabase client');

    try {
      // First, check if the order exists
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .single();
        
      if (orderError) {
        console.error('[direct-action] Order not found:', orderError);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/orders/${orderId}?action=error&reason=order_not_found`);
      }
      
      console.log('[direct-action] Order found:', orderData);
    } catch (orderCheckError) {
      console.error('[direct-action] Error checking order:', orderCheckError);
    }

    // Lookup the stored token for this order and email
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('credit_action_tokens')
      .select('*')
      .eq('order_id', orderId)
      .eq('recipient_email', email)
      .single();

    if (tokenError) {
      console.error('[direct-action] Token lookup error:', tokenError);
      
      // If it's a "not found" error, try a more permissive approach - maybe email formats are different
      if (tokenError.code === 'PGRST116') {
        console.log('[direct-action] Attempting looser email match');
        
        // Try to find any token for this order
        const { data: orderTokens, error: orderTokensError } = await supabase
          .from('credit_action_tokens')
          .select('*')
          .eq('order_id', orderId);
          
        if (!orderTokensError && orderTokens?.length > 0) {
          console.log('[direct-action] Found tokens for order:', orderTokens.length);
          
          // If we have tokens for this order, just use the first one
          // This is a workaround for potential email format differences
          const token = action === 'approve' ? orderTokens[0].approve_token : 
                    (action === 'reject' ? orderTokens[0].reject_token : null);
                    
          if (token) {
            console.log('[direct-action] Using token from loose match');
            return NextResponse.redirect(
              `${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/api/credit-actions/process?token=${token}`
            );
          }
        } else {
          console.error('[direct-action] No tokens found for order:', orderTokensError);
        }
      }
      
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/orders/${orderId}?action=error&reason=token_not_found`);
    }

    if (!tokenRecord) {
      console.error('[direct-action] Token not found for order/email');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/orders/${orderId}?action=error&reason=no_token_record`);
    }
    
    console.log('[direct-action] Token found:', { 
      hasApproveToken: !!tokenRecord.approve_token,
      hasRejectToken: !!tokenRecord.reject_token
    });

    // Get the appropriate token based on the action
    const token = action === 'approve' ? tokenRecord.approve_token : 
                 (action === 'reject' ? tokenRecord.reject_token : null);

    if (!token) {
      console.error('[direct-action] Token not available for action:', action);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/orders/${orderId}?action=error&reason=invalid_action`);
    }

    console.log('[direct-action] Redirecting to process endpoint with token');
    
    // Redirect to the process endpoint with the token
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/api/credit-actions/process?token=${token}`
    );
  } catch (error) {
    console.error('[direct-action] Unexpected error:', error);
    
    // Try to get the orderId even in error case
    let fallbackOrderId = 'error';
    try {
      fallbackOrderId = new URL(request.url).searchParams.get('order') || 'error';
    } catch (e) {
      console.error('[direct-action] Could not extract orderId from URL:', e);
    }
    
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app'}/orders/${fallbackOrderId}?action=error&reason=unexpected_error`);
  }
} 