import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://app.dcconcretos.com'

serve(async (req) => {
  // Create a Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Get the order details from the request
  const { record, type } = await req.json()
  
  // Determine the notification type (new_order or rejected_by_validator)
  const notificationType = type || 'new_order';
  
  // Get order details with separate queries to avoid PGRST200 errors
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, requires_invoice, credit_status, special_requirements, rejection_reason, client_id, created_by')
    .eq('id', record.id)
    .single()
  
  if (orderError) {
    console.error('Error fetching order:', orderError)
    return new Response(JSON.stringify({ error: orderError.message }), { status: 400 })
  }
  
  // Get client details
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('business_name')
    .eq('id', order.client_id)
    .single()
    
  if (clientError) {
    console.error('Error fetching client:', clientError)
    return new Response(JSON.stringify({ error: clientError.message }), { status: 400 })
  }
  
  // Get creator details
  const { data: creator, error: creatorError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name')
    .eq('id', order.created_by)
    .single()
    
  if (creatorError) {
    console.error('Error fetching creator:', creatorError)
    return new Response(JSON.stringify({ error: creatorError.message }), { status: 400 })
  }
  
  // Determine recipient roles based on notification type
  let recipientRoles = [];
  
  if (notificationType === 'new_order') {
    // Nuevas órdenes van a validadores de crédito
    recipientRoles = ['CREDIT_VALIDATOR'];
  } else if (notificationType === 'rejected_by_validator') {
    // Órdenes rechazadas por validadores van a gerentes y ejecutivos
    recipientRoles = ['EXECUTIVE', 'PLANT_MANAGER'];
  }
  
  // Get email recipients with their roles
  const { data: recipients, error: recipientsError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name, role')
    .in('role', recipientRoles)
  
  if (recipientsError) {
    console.error('Error fetching recipients:', recipientsError)
    return new Response(JSON.stringify({ error: recipientsError.message }), { status: 400 })
  }
  
  // Prepare email subject and content based on notification type
  let emailSubject, emailContent;
  
  if (notificationType === 'rejected_by_validator') {
    emailSubject = `Revisión de rechazo de crédito - Pedido ${order.order_number}`;
    emailContent = `
      <h2>Revisión de rechazo de crédito requerida</h2>
      <p>Un validador de crédito ha rechazado la siguiente orden:</p>
      <p>Cliente: ${client.business_name}</p>
      <p>Número de Pedido: ${order.order_number}</p>
      <p>Requiere Factura: ${order.requires_invoice ? 'Sí' : 'No'}</p>
      <p>Razón de rechazo: ${order.rejection_reason || 'No especificada'}</p>
      <p>Creado por: ${creator.first_name} ${creator.last_name}</p>
      <p><a href="https://cotizaciones-concreto.vercel.app//orders/${order.id}">Revisar pedido</a></p>
    `;
  } else {
    emailSubject = `Validación de crédito requerida - Pedido ${order.order_number}`;
    emailContent = `
      <h2>Se requiere validación de crédito</h2>
      <p>Cliente: ${client.business_name}</p>
      <p>Número de Pedido: ${order.order_number}</p>
      <p>Requiere Factura: ${order.requires_invoice ? 'Sí' : 'No'}</p>
      <p>Creado por: ${creator.first_name} ${creator.last_name}</p>
      <p><a href="https://cotizaciones-concreto.vercel.app/orders/${order.id}">Revisar pedido</a></p>
    `;
  }
  
  // Send email using SendGrid API for each recipient
  for (const recipient of recipients) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: recipient.email }]
        }],
        from: { email: "juan.aguirre@dssolutions-mx.com" },
        subject: emailSubject,
        content: [{
          type: "text/html",
          value: emailContent
        }]
      })
    })
    
    if (!response.ok) {
      console.error('Error sending email via SendGrid:', await response.text())
    } else {
      // Record notification in database
      await supabase
        .from('order_notifications')
        .insert({
          order_id: order.id,
          notification_type: notificationType === 'rejected_by_validator' ? 
            'CREDIT_REJECTION_REVIEW' : 'CREDIT_VALIDATION_REQUEST',
          recipient: recipient.email,
          delivery_status: response.ok ? 'SENT' : 'FAILED'
        })
    }
  }
  
  return new Response(JSON.stringify({ success: true }), { 
    headers: { "Content-Type": "application/json" } 
  })
}) 