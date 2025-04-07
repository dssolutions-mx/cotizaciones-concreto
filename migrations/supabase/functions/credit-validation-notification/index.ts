import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

serve(async (req) => {
  // Create a Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Get the order details from the request
  const { record } = await req.json()
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, 
      order_number, 
      requires_invoice,
      clients (business_name),
      created_by (email, first_name, last_name)
    `)
    .eq('id', record.id)
    .single()
  
  if (orderError) {
    console.error('Error fetching order:', orderError)
    return new Response(JSON.stringify({ error: orderError.message }), { status: 400 })
  }
  
  // Get executives/managers who need to validate credit
  const { data: validators, error: validatorsError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name')
    .in('role', ['EXECUTIVE', 'PLANT_MANAGER'])
  
  if (validatorsError) {
    console.error('Error fetching validators:', validatorsError)
    return new Response(JSON.stringify({ error: validatorsError.message }), { status: 400 })
  }
  
  // Prepare email content
  const emailContent = `
    <h2>Se requiere validación de crédito</h2>
    <p>Cliente: ${order.clients.business_name}</p>
    <p>Número de Pedido: ${order.order_number}</p>
    <p>Requiere Factura: ${order.requires_invoice ? 'Sí' : 'No'}</p>
    <p>Creado por: ${order.created_by.first_name} ${order.created_by.last_name}</p>
    <p><a href="${SUPABASE_URL}/admin/orders/${order.id}">Revisar pedido</a></p>
  `
  
  // Send email using SendGrid API
  for (const validator of validators) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: validator.email }]
        }],
        from: { email: "juan.aguirre@dssolutions-mx.com" },
        subject: `Validación de crédito requerida - Pedido ${order.order_number}`,
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
          notification_type: 'CREDIT_VALIDATION_REQUEST',
          recipient: validator.email,
          delivery_status: response.ok ? 'SENT' : 'FAILED'
        })
    }
  }
  
  return new Response(JSON.stringify({ success: true }), { 
    headers: { "Content-Type": "application/json" } 
  })
}) 