import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || supabaseServiceKey;

// Function to verify JWT
const verifyJWT = async (token: string) => {
  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const signatureBytes = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    
    // Create HMAC signature for comparison
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest();
    
    // Compare signatures - timing-safe comparison would be better in production
    const signatureBuffer = Buffer.from(signatureBytes);
    if (signatureBuffer.length !== expectedSignature.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < signatureBuffer.length; i++) {
      mismatch |= signatureBuffer[i] ^ expectedSignature[i];
    }

    if (mismatch !== 0) {
      return false;
    }

    // Decode payload
    const payloadString = Buffer.from(encodedPayload, 'base64').toString();
    const payload = JSON.parse(payloadString);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
};

export async function GET(request: Request) {
  try {
    // Get the token from the URL
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token no proporcionado' }, { status: 400 });
    }

    // Verify the JWT
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    // Extract the data from the payload
    const { data } = payload;
    const { orderId, action, recipientEmail } = data;

    // Validate token structure
    if (!orderId || !action || !recipientEmail) {
      return NextResponse.json({ error: 'Formato de token inválido' }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token against database (extra security)
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('credit_action_tokens')
      .select('*')
      .eq('order_id', orderId)
      .eq('recipient_email', recipientEmail)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'Token no encontrado en la base de datos' }, { status: 404 });
    }

    // Verify if this specific token is valid
    // Note: We should store JWT tokens in the database rather than our old tokens
    // This is a transitional approach that validates both
    const isApproveAction = action === 'approve';
    const isRejectAction = action === 'reject';

    if (!isApproveAction && !isRejectAction) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 401 });
    }

    // Get the order to verify it's in the correct state
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('credit_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Check if the order is in a valid state for action
    const validStates = ['PENDING', 'REJECTED_BY_VALIDATOR'];
    if (!validStates.includes(order.credit_status)) {
      return NextResponse.json({ 
        error: 'Esta orden ya no está pendiente de validación de crédito' 
      }, { status: 409 });
    }

    // Process the action
    if (isApproveAction) {
      // Approve credit
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          credit_status: 'APPROVED',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        return NextResponse.json({ error: 'Error al aprobar el crédito' }, { status: 500 });
      }

      // Log the action
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'CREDIT_APPROVED',
        performed_by: recipientEmail,
        action_method: 'EMAIL_TOKEN'
      });

      // Delete used tokens
      await supabase
        .from('credit_action_tokens')
        .delete()
        .eq('order_id', orderId);

      // Redirect to success page
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?action=approved`);
    } 
    
    if (isRejectAction) {
      // If current status is PENDING, reject by validator
      const newStatus = order.credit_status === 'PENDING' 
        ? 'REJECTED_BY_VALIDATOR' 
        : 'REJECTED'; // Final rejection
      
      const rejectionReason = order.credit_status === 'PENDING'
        ? 'Rechazado por validador mediante enlace de email'
        : 'Rechazado definitivamente por gerencia mediante enlace de email';

      // Reject credit
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          credit_status: newStatus,
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        return NextResponse.json({ error: 'Error al rechazar el crédito' }, { status: 500 });
      }

      // Log the action
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: newStatus === 'REJECTED_BY_VALIDATOR' ? 'CREDIT_REJECTED_BY_VALIDATOR' : 'CREDIT_REJECTED',
        performed_by: recipientEmail,
        action_method: 'EMAIL_TOKEN'
      });

      // If this is a rejection by validator, trigger notification to managers
      if (newStatus === 'REJECTED_BY_VALIDATOR') {
        // Call Edge Function to send notification to managers
        const { error: notificationError } = await supabase.functions.invoke('credit-validation-notification', {
          body: { 
            record: { id: orderId },
            type: 'rejected_by_validator'
          }
        });

        if (notificationError) {
          console.error('Error sending notification:', notificationError);
        }
      }

      // Delete used tokens
      await supabase
        .from('credit_action_tokens')
        .delete()
        .eq('order_id', orderId);

      // Redirect to success page
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?action=rejected`);
    }

    // Should never reach here
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 });
  } catch (error) {
    console.error('Error processing credit action:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 