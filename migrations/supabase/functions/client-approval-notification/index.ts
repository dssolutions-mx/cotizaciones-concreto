import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://cotizaciones-concreto.vercel.app';

// Helper function to format currency
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A';
  return amount.toLocaleString('es-MX', { minimumFractionDigits: 2 });
};

// Format date helper
const formatDateStr = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-MX', options);
  } catch (e) {
    return dateStr;
  }
};

const formatTimeStr = (timeStr) => {
  return timeStr ? timeStr.substring(0, 5) : 'N/A';
};

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { record, type } = await req.json();
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      client_id,
      created_by,
      delivery_date,
      delivery_time,
      preliminary_amount,
      invoice_amount,
      special_requirements,
      client_approval_status,
      client_approved_by,
      client_rejection_reason
    `)
    .eq('id', record.id)
    .single();

  if (orderError) {
    console.error('Error fetching order:', orderError);
    return new Response(JSON.stringify({ error: orderError.message }), { status: 400 });
  }

  // Get client details
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('business_name, client_code')
    .eq('id', order.client_id)
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return new Response(JSON.stringify({ error: clientError.message }), { status: 400 });
  }

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
    .btn-container { margin-top: 25px; }
    .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .btn-view { background-color: #3b82f6; color: white; }
    .notes { margin-top: 15px; padding: 10px; background-color: #f8fafc; border-left: 4px solid #94a3b8; }
    .success { color: #22c55e; font-weight: bold; }
    .error { color: #ef4444; font-weight: bold; }
  `;

  if (type === 'order_pending_approval') {
    // Notify client executives about pending order
    // Get all executives for this client
    const { data: executives, error: execError } = await supabase
      .from('client_portal_users')
      .select('user_id')
      .eq('client_id', order.client_id)
      .eq('role_within_client', 'executive')
      .eq('is_active', true);

    if (execError || !executives || executives.length === 0) {
      console.error('Error fetching executives or no executives found:', execError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No executives found for client' 
      }), { status: 200 });
    }

    // Get order creator details
    const { data: creator, error: creatorError } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', order.created_by)
      .single();

    const creatorName = creator ? `${creator.first_name} ${creator.last_name}` : 'Usuario del portal';

    // Send email to each executive
    for (const exec of executives) {
      // Get executive profile
      const { data: execProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('email, first_name, last_name')
        .eq('id', exec.user_id)
        .single();

      if (profileError || !execProfile || !execProfile.email) {
        console.error('Error fetching executive profile:', profileError);
        continue;
      }

      const viewOrderUrl = `${FRONTEND_URL}/orders/${order.id}`;
      const approveUrl = `${FRONTEND_URL}/orders/${order.id}?action=approve`;
      const rejectUrl = `${FRONTEND_URL}/orders/${order.id}?action=reject`;

      const emailSubject = `Aprobación requerida - Pedido ${order.order_number}`;
      const emailContent = `
        <html>
        <head>
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Se requiere su aprobación</h1>
              <h2 class="subtitle">Pedido: ${order.order_number}</h2>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${client.business_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Creado por:</span>
                <span class="info-value">${creatorName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrega:</span>
                <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Monto Preliminar:</span>
                <span class="info-value">$${formatCurrency(order.preliminary_amount)}</span>
              </div>
            </div>
            
            ${order.special_requirements ? `
            <div class="notes">
              <p><strong>Requisitos especiales:</strong> ${order.special_requirements.substring(0, 200)}${order.special_requirements.length > 200 ? '...' : ''}</p>
            </div>
            ` : ''}
            
            <div class="btn-container">
              <a href="${approveUrl}" class="btn btn-approve">Aprobar Pedido</a>
              <a href="${rejectUrl}" class="btn btn-reject">Rechazar Pedido</a>
              <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles Completos</a>
            </div>
            
            <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
              Este pedido fue creado por un usuario no ejecutivo y requiere su aprobación antes de ser procesado.
            </p>
          </div>
        </body>
        </html>
      `;

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: execProfile.email }]
          }],
          from: { email: "juan.aguirre@dssolutions-mx.com" },
          subject: emailSubject,
          content: [{ type: "text/html", value: emailContent }]
        })
      });

      if (response.ok) {
        await supabase.from('order_notifications').insert({
          order_id: order.id,
          notification_type: 'CLIENT_APPROVAL_REQUEST',
          recipient: execProfile.email,
          delivery_status: 'SENT'
        });
      }
    }

  } else if (type === 'order_approved_by_client' || type === 'order_rejected_by_client') {
    // Notify order creator about approval/rejection
    const { data: creator, error: creatorError } = await supabase
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', order.created_by)
      .single();

    if (creatorError || !creator) {
      console.error('Error fetching creator:', creatorError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Creator not found' 
      }), { status: 200 });
    }

    // Get approver details if approved
    let approverName = 'Ejecutivo del cliente';
    if (order.client_approved_by) {
      const { data: approver, error: approverError } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', order.client_approved_by)
        .single();
      
      if (!approverError && approver) {
        approverName = `${approver.first_name} ${approver.last_name}`;
      }
    }

    const isApproved = type === 'order_approved_by_client';
    const emailSubject = isApproved 
      ? `Pedido ${order.order_number} aprobado`
      : `Pedido ${order.order_number} rechazado`;
    
    const statusMessage = isApproved 
      ? '<p class="success">✓ Su pedido ha sido aprobado por el ejecutivo del cliente.</p>'
      : '<p class="error">✗ Su pedido ha sido rechazado por el ejecutivo del cliente.</p>';

    const viewOrderUrl = `${FRONTEND_URL}/orders/${order.id}`;
    
    const emailContent = `
      <html>
      <head>
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">${isApproved ? 'Pedido Aprobado' : 'Pedido Rechazado'}</h1>
            <h2 class="subtitle">Pedido: ${order.order_number}</h2>
            ${statusMessage}
          </div>
          
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Cliente:</span>
              <span class="info-value">${client.business_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Entrega:</span>
              <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isApproved ? 'Aprobado por:' : 'Rechazado por:'}</span>
              <span class="info-value">${approverName}</span>
            </div>
            ${!isApproved && order.client_rejection_reason ? `
            <div class="info-row">
              <span class="info-label">Razón:</span>
              <span class="info-value">${order.client_rejection_reason}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="btn-container">
            <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles del Pedido</a>
          </div>
          
          ${isApproved ? `
          <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
            Su pedido ahora será procesado para validación de crédito. Recibirá una notificación cuando sea aprobado o rechazado.
          </p>
          ` : `
          <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
            Puede crear un nuevo pedido o contactar al ejecutivo del cliente para más información.
          </p>
          `}
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: creator.email }]
        }],
        from: { email: "juan.aguirre@dssolutions-mx.com" },
        subject: emailSubject,
        content: [{ type: "text/html", value: emailContent }]
      })
    });

    if (response.ok) {
      await supabase.from('order_notifications').insert({
        order_id: order.id,
        notification_type: isApproved ? 'CLIENT_APPROVAL_APPROVED' : 'CLIENT_APPROVAL_REJECTED',
        recipient: creator.email,
        delivery_status: 'SENT'
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
});

