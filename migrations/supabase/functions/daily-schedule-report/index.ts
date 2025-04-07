import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

serve(async (req) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const formattedDate = tomorrow.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Create a Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Get tomorrow's orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id, 
      order_number,
      requires_invoice,
      delivery_time,
      construction_site,
      special_requirements,
      clients (business_name, contact_name, phone),
      order_items (
        product_type,
        volume,
        unit_price,
        has_pump_service,
        pump_price,
        has_empty_truck_charge,
        empty_truck_volume,
        empty_truck_price
      )
    `)
    .eq('delivery_date', tomorrow.toISOString().split('T')[0])
    .eq('credit_status', 'approved')
    .eq('order_status', 'validated')
  
  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
    return new Response(JSON.stringify({ error: ordersError.message }), { status: 400 })
  }
  
  // Generate HTML table for orders
  const ordersHtml = orders.map(order => {
    const items = order.order_items.map(item => `
      <tr>
        <td>${item.product_type}</td>
        <td>${item.volume} m³</td>
        <td>${item.has_pump_service ? 'Sí' : 'No'}</td>
        <td>${new Date(`2000-01-01T${order.delivery_time}`).toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit'
        })}</td>
      </tr>
    `).join('');
    
    return `
      <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
        <h3>Pedido: ${order.order_number}</h3>
        <p><strong>Cliente:</strong> ${order.clients.business_name}</p>
        <p><strong>Obra:</strong> ${order.construction_site}</p>
        <p><strong>Contacto:</strong> ${order.clients.contact_name} (${order.clients.phone})</p>
        <p><strong>Hora de entrega:</strong> ${new Date(`2000-01-01T${order.delivery_time}`).toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        <p><strong>Requiere Factura:</strong> ${order.requires_invoice ? 'Sí' : 'No'}</p>
        
        <h4>Productos:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="text-align: left; padding: 8px;">Tipo</th>
              <th style="text-align: left; padding: 8px;">Volumen</th>
              <th style="text-align: left; padding: 8px;">Bombeo</th>
              <th style="text-align: left; padding: 8px;">Hora</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>
        
        ${order.special_requirements ? `
          <h4>Requerimientos Especiales:</h4>
          <p>${order.special_requirements}</p>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Get email recipients
  const { data: recipients, error: recipientsError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name, role')
    .in('role', ['EXECUTIVE', 'PLANT_MANAGER', 'SALES_AGENT'])
  
  if (recipientsError) {
    console.error('Error fetching recipients:', recipientsError)
    return new Response(JSON.stringify({ error: recipientsError.message }), { status: 400 })
  }
  
  // Prepare email content
  const emailContent = `
    <h1>Programación de Entregas - ${formattedDate}</h1>
    ${orders.length > 0 ? `
      <p>Se han programado ${orders.length} pedidos para mañana:</p>
      ${ordersHtml}
    ` : `
      <p>No hay pedidos programados para mañana.</p>
    `}
  `;
  
  // Send email using SendGrid API
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: recipients.map(recipient => ({ email: recipient.email }))
      }],
      from: { email: "juan.aguirre@dssolutions-mx.com" },
      subject: `Programación de Entregas - ${formattedDate}`,
      content: [{
        type: "text/html",
        value: emailContent
      }]
    })
  });
  
  if (!response.ok) {
    console.error('Error sending email via SendGrid:', await response.text());
    return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
  }
  
  // Record notifications in database
  if (orders.length > 0) {
    const notificationRecords = recipients.flatMap(recipient => 
      orders.map(order => ({
        order_id: order.id,
        notification_type: 'DAILY_SCHEDULE',
        recipient: recipient.email,
        delivery_status: response.ok ? 'SENT' : 'FAILED'
      }))
    );
    
    const { error: notificationError } = await supabase
      .from('order_notifications')
      .insert(notificationRecords);
      
    if (notificationError) {
      console.error('Error recording notifications:', notificationError);
    }
  }
  
  return new Response(JSON.stringify({ success: true, orders_count: orders.length }), { 
    headers: { "Content-Type": "application/json" } 
  });
}) 