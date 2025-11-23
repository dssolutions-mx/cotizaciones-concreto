import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { format } from 'https://deno.land/x/date_fns@v2.22.1/index.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://cotizaciones-concreto.vercel.app';

// Helper function to format currency
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A';
  return amount.toLocaleString('es-MX', { minimumFractionDigits: 2 });
};

// Helper function to create a secure action token following JWT standards
const generateActionToken = async (orderId, action, recipientEmail, expiresIn = 86400) => {
  try {
    // Current timestamp in seconds
    const now = Math.floor(Date.now() / 1000);
    // Token expires in 24 hours by default
    const exp = now + expiresIn;
    
    // Create JWT header
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    // Create token payload (claims)
    const payload = {
      sub: recipientEmail,
      iss: 'credit-validation-system',
      iat: now,
      exp: exp,
      data: {
        orderId,
        action,
        recipientEmail
      }
    };
    
    // Get JWT secret from environment
    const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_KEY;
    
    // Base64Url encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Create signature - in production use a proper HMAC library
    // This is a simplified implementation
    const data = encodedHeader + '.' + encodedPayload;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );
    
    // Convert signature to base64url
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Combine all parts
    const jwt = `${encodedHeader}.${encodedPayload}.${signatureBase64}`;
    
    return jwt;
  } catch (error) {
    console.error('Error generating JWT:', error);
    // Fallback to simple token if JWT generation fails
    const fallbackToken = btoa(JSON.stringify({
      orderId, action, recipientEmail, exp: now + expiresIn
    }));
    return fallbackToken;
  }
};

serve(async (req)=>{
  // Create a Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  // Get the order details from the request
  const { record, type } = await req.json();
  // Determine the notification type (new_order or rejected_by_validator)
  const notificationType = type || 'new_order';
  
  // Get order details with more financial and delivery information
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, 
      order_number, 
      requires_invoice, 
      credit_status, 
      special_requirements, 
      rejection_reason, 
      client_id, 
      created_by,
      delivery_date,
      delivery_time,
      preliminary_amount,
      invoice_amount,
      previous_client_balance,
      client_approval_status,
      client_approved_by,
      client_approval_date
    `)
    .eq('id', record.id)
    .single();

  if (orderError) {
    console.error('Error fetching order:', orderError);
    return new Response(JSON.stringify({
      error: orderError.message
    }), {
      status: 400
    });
  }
  
  // Get client details with client code
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('business_name, client_code')
    .eq('id', order.client_id)
    .single();
    
  if (clientError) {
    console.error('Error fetching client:', clientError);
    return new Response(JSON.stringify({
      error: clientError.message
    }), {
      status: 400
    });
  }
  
  // Get creator details
  const { data: creator, error: creatorError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name')
    .eq('id', order.created_by)
    .single();
    
  if (creatorError) {
    console.error('Error fetching creator:', creatorError);
    return new Response(JSON.stringify({
      error: creatorError.message
    }), {
      status: 400
    });
  }
  
  // Get client approver details if order was approved by client executive
  let clientApprover = null;
  if (notificationType === 'client_approved_order' && order.client_approved_by) {
    const { data: approver, error: approverError } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', order.client_approved_by)
      .single();
    
    if (!approverError) {
      clientApprover = approver;
    }
  }
  
  // Format the delivery date and time
  const formatDateStr = (dateStr) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), 'PPP', { locale: 'es' });
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatTimeStr = (timeStr) => {
    return timeStr ? timeStr.substring(0, 5) : 'N/A';
  };
  
  // Calculate projected balance
  const previousBalance = order.previous_client_balance || 0;
  const orderAmount = order.invoice_amount || 0;
  const projectedBalance = previousBalance + orderAmount;
  
  // Determine recipient roles based on notification type
  let recipientRoles = [];
  if (notificationType === 'new_order' || notificationType === 'client_approved_order') {
    // Nuevas órdenes van a validadores de crédito
    // client_approved_order: Order was approved by client executive, now needs credit validation
    recipientRoles = [
      'CREDIT_VALIDATOR'
    ];
  } else if (notificationType === 'rejected_by_validator') {
    // Órdenes rechazadas por validadores van a gerentes y ejecutivos
    recipientRoles = [
      'EXECUTIVE',
      'PLANT_MANAGER'
    ];
  }
  
  // Get email recipients with their roles
  const { data: recipients, error: recipientsError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name, role')
    .in('role', recipientRoles);
    
  if (recipientsError) {
    console.error('Error fetching recipients:', recipientsError);
    return new Response(JSON.stringify({
      error: recipientsError.message
    }), {
      status: 400
    });
  }
  
  // Limit special requirements text
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
  };

  // CSS for email styling
  const emailStyles = `
    .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
    .subtitle { font-size: 18px; color: #334155; margin-bottom: 15px; }
    .info-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-label { color: #64748b; font-weight: normal; }
    .info-value { font-weight: bold; color: #334155; }
    .financial-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
    .financial-title { color: #475569; font-weight: bold; margin-bottom: 10px; }
    .financial-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .financial-total { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
    .negative { color: #ef4444; }
    .positive { color: #22c55e; }
    .btn-container { margin-top: 25px; }
    .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .btn-view { background-color: #3b82f6; color: white; }
    .notes { margin-top: 15px; padding: 10px; background-color: #f8fafc; border-left: 4px solid #94a3b8; }
  `;

  // Prepare email subject and content based on notification type
  let emailSubject, emailContent;
  
  // Send email using SendGrid API for each recipient
  for (const recipient of recipients) {
    // Generate action tokens for this recipient
    const approveToken = await generateActionToken(order.id, 'approve', recipient.email);
    const rejectToken = await generateActionToken(order.id, 'reject', recipient.email);
    
    // Use both direct-action and process endpoints for backward compatibility
    // Direct action URLs are more friendly for email clients that modify links (like SendGrid's click tracking)
    const approveUrl = `${FRONTEND_URL}/api/credit-actions/direct-action?order=${order.id}&action=approve&email=${encodeURIComponent(recipient.email)}`;
    const rejectUrl = `${FRONTEND_URL}/api/credit-actions/direct-action?order=${order.id}&action=reject&email=${encodeURIComponent(recipient.email)}`;
    const viewOrderUrl = `${FRONTEND_URL}/orders/${order.id}`;
    
    if (notificationType === 'rejected_by_validator') {
      emailSubject = `Revisión de rechazo de crédito - Pedido ${order.order_number}`;
      emailContent = `
        <html>
        <head>
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Revisión de rechazo de crédito requerida</h1>
              <h2 class="subtitle">Pedido: ${order.order_number}</h2>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${client.business_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Código de cliente:</span>
                <span class="info-value">${client.client_code || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrega:</span>
                <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Requiere Factura:</span>
                <span class="info-value">${order.requires_invoice ? 'Sí' : 'No'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Creado por:</span>
                <span class="info-value">${creator.first_name} ${creator.last_name}</span>
              </div>
            </div>
            
            <div class="financial-box">
              <h3 class="financial-title">Información Financiera</h3>
              <div class="financial-row">
                <span class="info-label">Monto Preliminar:</span>
                <span class="info-value">$${formatCurrency(order.preliminary_amount)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Balance Actual (Previo):</span>
                <span class="info-value ${previousBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(previousBalance)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Monto Orden (con IVA si aplica):</span>
                <span class="info-value">$${formatCurrency(orderAmount)}</span>
              </div>
              <div class="financial-row financial-total">
                <span class="info-label">Balance Proyectado:</span>
                <span class="info-value ${projectedBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(projectedBalance)}</span>
              </div>
            </div>
            
            <div class="notes">
              <p><strong>Razón de rechazo:</strong> ${order.rejection_reason || 'No especificada'}</p>
              ${order.special_requirements ? `<p><strong>Notas adicionales:</strong> ${truncateText(order.special_requirements, 200)}</p>` : ''}
            </div>
            
            <div class="btn-container">
              <a href="${approveUrl}" class="btn btn-approve">Aprobar Crédito</a>
              <a href="${rejectUrl}" class="btn btn-reject">Rechazar Definitivamente</a>
              <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles Completos</a>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Handle both 'new_order' and 'client_approved_order' types
      const isClientApproved = notificationType === 'client_approved_order';
      emailSubject = isClientApproved 
        ? `Validación de crédito requerida - Pedido ${order.order_number} (Aprobado por cliente)`
        : `Validación de crédito requerida - Pedido ${order.order_number}`;
      
      emailContent = `
        <html>
        <head>
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Se requiere validación de crédito</h1>
              <h2 class="subtitle">Pedido: ${order.order_number}</h2>
              ${isClientApproved ? '<p style="color: #22c55e; font-weight: bold; margin-top: 10px;">✓ Aprobado por cliente ejecutivo</p>' : ''}
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${client.business_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Código de cliente:</span>
                <span class="info-value">${client.client_code || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrega:</span>
                <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Requiere Factura:</span>
                <span class="info-value">${order.requires_invoice ? 'Sí' : 'No'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Creado por:</span>
                <span class="info-value">${creator.first_name} ${creator.last_name}</span>
              </div>
              ${isClientApproved && clientApprover ? `
              <div class="info-row">
                <span class="info-label">Aprobado por cliente:</span>
                <span class="info-value">${clientApprover.first_name} ${clientApprover.last_name}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="financial-box">
              <h3 class="financial-title">Información Financiera</h3>
              <div class="financial-row">
                <span class="info-label">Monto Preliminar:</span>
                <span class="info-value">$${formatCurrency(order.preliminary_amount)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Balance Actual (Previo):</span>
                <span class="info-value ${previousBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(previousBalance)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Monto Orden (con IVA si aplica):</span>
                <span class="info-value">$${formatCurrency(orderAmount)}</span>
              </div>
              <div class="financial-row financial-total">
                <span class="info-label">Balance Proyectado:</span>
                <span class="info-value ${projectedBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(projectedBalance)}</span>
              </div>
            </div>
            
            ${order.special_requirements ? `
            <div class="notes">
              <p><strong>Requisitos especiales:</strong> ${truncateText(order.special_requirements, 200)}</p>
            </div>
            ` : ''}
            
            <div class="btn-container">
              <a href="${approveUrl}" class="btn btn-approve">Aprobar Crédito</a>
              <a href="${rejectUrl}" class="btn btn-reject">Rechazar Crédito</a>
              <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles Completos</a>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: recipient.email
              }
            ]
          }
        ],
        from: {
          email: "juan.aguirre@dssolutions-mx.com"
        },
        subject: emailSubject,
        content: [
          {
            type: "text/html",
            value: emailContent
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Error sending email via SendGrid:', await response.text());
    } else {
      // Record notification in database
      let notificationTypeDb = 'CREDIT_VALIDATION_REQUEST';
      if (notificationType === 'rejected_by_validator') {
        notificationTypeDb = 'CREDIT_REJECTION_REVIEW';
      } else if (notificationType === 'client_approved_order') {
        notificationTypeDb = 'CREDIT_VALIDATION_REQUEST_CLIENT_APPROVED';
      }
      
      await supabase.from('order_notifications').insert({
        order_id: order.id,
        notification_type: notificationTypeDb,
        recipient: recipient.email,
        delivery_status: response.ok ? 'SENT' : 'FAILED'
      });
      
      // Store tokens in database for validation
      await supabase.from('credit_action_tokens').insert({
        order_id: order.id,
        recipient_email: recipient.email,
        approve_token: approveToken,
        reject_token: rejectToken,
        jwt_token: approveToken,  // Store JWT token
        expires_at: new Date(Date.now() + 86400 * 1000).toISOString() // 24 hours from now
      });
    }
  }

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
