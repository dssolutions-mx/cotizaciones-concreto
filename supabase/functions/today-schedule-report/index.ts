import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * TODAY SCHEDULE REPORT EDGE FUNCTION
 * 
 * ROBUST PUMP SERVICE HANDLING:
 * This function handles both the OLD and NEW pump service structures:
 * 
 * OLD STRUCTURE (Legacy):
 * - Concrete items have has_pump_service=true, pump_price, pump_volume fields
 * - Pump service is embedded within concrete items
 * 
 * NEW STRUCTURE (Current):
 * - Pump service is a separate order item with product_type='SERVICIO DE BOMBEO'
 * - Concrete items have has_pump_service=false (or null)
 * 
 * VOLUME CALCULATION LOGIC:
 * - Concrete volume: Only from items where product_type != 'SERVICIO DE BOMBEO'
 * - Pump volume: From both new pump service items AND old-style pump services on concrete items
 * - This ensures accurate totals regardless of which structure is used
 * 
 * COMPATIBILITY:
 * - Supports mixed orders (some with old structure, some with new)
 * - Automatically detects and categorizes each item type
 * - Maintains backward compatibility while supporting new structure
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

// Email configuration
const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com";
const FROM_NAME = "SISTEMA DE GESTION DE PEDIDOS";

// Timezone offset for Mexico (GMT-6)
const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000; // -6 hours in milliseconds

// Helper function to get a date in Mexico's timezone
function getMexicoDate(date = new Date()) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + TIMEZONE_OFFSET);
}

// Helper function to format a date as YYYY-MM-DD in Mexico's timezone
function formatDateForDB(date = new Date()) {
  const mexicoDate = getMexicoDate(date);
  const year = mexicoDate.getFullYear();
  const month = String(mexicoDate.getMonth() + 1).padStart(2, '0');
  const day = String(mexicoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

serve(async (req)=>{
  try {
    // Try to get date from request parameters or default to TODAY in Mexico's timezone
    let targetDate;
    let targetDateString;
  
    try {
      const url = new URL(req.url);
      const dateParam = url.searchParams.get('date');
      
      if (dateParam) {
        // Use the provided date param (format: YYYY-MM-DD)
        // Still convert to Mexico time to ensure consistent handling
        const [year, month, day] = dateParam.split('-').map(num => parseInt(num, 10));
        
        if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new Error('Invalid date format, use YYYY-MM-DD');
        }
        
        // Create date object (month is 0-indexed in JavaScript)
        targetDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone edge cases
        targetDateString = formatDateForDB(targetDate);
      } else {
        // Default to TODAY in Mexico's timezone
        const mexicoToday = getMexicoDate();
        
        targetDate = mexicoToday;
        targetDateString = formatDateForDB(mexicoToday);
      }
      
      console.log(`Using target date: ${targetDateString} (Mexico time)`);
    } catch (error) {
      console.error('Error processing date parameter:', error);
      return new Response(JSON.stringify({
        error: 'Invalid date format, use YYYY-MM-DD'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Format for display in the email
    const formattedDate = targetDate.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    console.log(`Fetching orders for date: ${targetDateString}`);
    
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Get ALL orders for target date with creator information (excluding cancelled orders)
    const { data: orders, error: ordersError } = await supabase.from('orders').select(`
        id, 
        order_number,
        requires_invoice,
        delivery_time,
        delivery_date,
        construction_site,
        special_requirements,
        created_by,
        credit_status,
        order_status,
        clients (business_name, contact_name, phone),
        order_items (
          id,
          product_type,
          volume,
          unit_price,
          has_pump_service,
          pump_price,
          pump_volume,
          has_empty_truck_charge,
          empty_truck_volume,
          empty_truck_price
        )
      `)
      .eq('delivery_date', targetDateString)
      .neq('order_status', 'cancelled');  // Exclude cancelled orders
        
    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(JSON.stringify({
        error: ordersError.message
      }), {
        status: 400
      });
    }
    
    console.log(`Found ${orders.length} orders for TODAY ${targetDateString} (excluding cancelled orders)`);
    
    // Calculate totals for summary
    let totalConcreteVolume = 0;
    let totalPumpingVolume = 0;
    let totalApprovedConcreteVolume = 0;
    let totalApprovedPumpingVolume = 0;
    
    console.log('=== VOLUME CALCULATION DEBUG ===');
    
    orders.forEach((order: any) => {
      // Update the condition for what's considered a fully approved order
      // Now an order is considered fully approved if it has credit_status = 'approved'
      // Regardless of whether order_status is 'validated' or 'created'
      const isFullyApproved = order.credit_status === 'approved' && 
        (order.order_status === 'validated' || order.order_status === 'created');
      
      console.log(`Order ${order.order_number}: credit_status=${order.credit_status}, order_status=${order.order_status}, isFullyApproved=${isFullyApproved}`);
      
      order.order_items.forEach((item: any) => {
        // ROBUST PUMP SERVICE DETECTION
        // Check if this is a pump service item (new structure)
        const isPumpServiceItem = item.product_type === 'SERVICIO DE BOMBEO';
        
        // Check if this item has pump service (old structure)
        const hasOldPumpService = item.has_pump_service === true && 
          item.pump_price !== null && Number(item.pump_price) > 0 &&
          item.pump_volume !== null && Number(item.pump_volume) > 0;
        
        console.log(`  Item ${item.id}: product_type="${item.product_type}", volume=${item.volume}, isPumpServiceItem=${isPumpServiceItem}, hasOldPumpService=${hasOldPumpService}`);
        
        // SEPARATE VOLUME CALCULATIONS
        if (isPumpServiceItem) {
          // This is a pump service item - add to pump volume totals
          const pumpVolume = Number(item.volume) || 0;
          totalPumpingVolume += pumpVolume;
          
          if (isFullyApproved) {
            totalApprovedPumpingVolume += pumpVolume;
          }
          
          console.log(`    → Added ${pumpVolume} m³ to pump volume (pump service item)`);
        } else {
          // This is a concrete item - add to concrete volume totals
          const concreteVolume = Number(item.volume) || 0;
          totalConcreteVolume += concreteVolume;
          
          if (isFullyApproved) {
            totalApprovedConcreteVolume += concreteVolume;
          }
          
          console.log(`    → Added ${concreteVolume} m³ to concrete volume (concrete item)`);
          
          // Also check for old-style pump service on concrete items
          if (hasOldPumpService) {
            const oldPumpVolume = Number(item.pump_volume) || 0;
            totalPumpingVolume += oldPumpVolume;
            
            if (isFullyApproved) {
              totalApprovedPumpingVolume += oldPumpVolume;
            }
            
            console.log(`    → Added ${oldPumpVolume} m³ to pump volume (old-style pump service)`);
          }
        }
      });
    });
    
    console.log('=== FINAL TOTALS ===');
    console.log(`Total Concrete Volume: ${totalConcreteVolume} m³`);
    console.log(`Total Pumping Volume: ${totalPumpingVolume} m³`);
    console.log(`Total Approved Concrete Volume: ${totalApprovedConcreteVolume} m³`);
    console.log(`Total Approved Pumping Volume: ${totalApprovedPumpingVolume} m³`);
    console.log('=== END DEBUG ===');
    
    // Helper function to get status badge
    const getStatusBadge = (status: any, type: any) => {
      let color = '#64748B'; // Default gray
      let bgColor = '#F1F5F9';
      let text = status || 'Pendiente';
      
      if (type === 'credit') {
        if (status === 'approved') {
          color = '#059669'; // Green
          bgColor = '#ECFDF5';
          text = 'Aprobado';
        } else if (status === 'rejected') {
          color = '#DC2626'; // Red
          bgColor = '#FEF2F2';
          text = 'Rechazado';
        } else if (status === 'pending') {
          color = '#D97706'; // Amber
          bgColor = '#FFFBEB';
          text = 'Pendiente';
        }
      } else if (type === 'order') {
        if (status === 'validated') {
          color = '#059669'; // Green
          bgColor = '#ECFDF5';
          text = 'Validado';
        } else if (status === 'pending') {
          color = '#D97706'; // Amber
          bgColor = '#FFFBEB';
          text = 'Pendiente';
        } else if (status === 'rejected') {
          color = '#DC2626'; // Red
          bgColor = '#FEF2F2';
          text = 'Rechazado';
        }
      }
      
      return `<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: ${bgColor}; color: ${color}; font-weight: 500;">${text}</span>`;
    };
    
    // Generate HTML table for orders
    const ordersHtml = orders.map((order: any) => {
      const isFullyApproved = order.credit_status === 'approved' && 
        (order.order_status === 'validated' || order.order_status === 'created');
      const statusClass = isFullyApproved ? '' : 'opacity: 0.85; border-left: 4px solid #FCA5A5;';
      
      const items = order.order_items.map((item: any) => {
        // ROBUST PUMP SERVICE DETECTION FOR DISPLAY
        const isPumpServiceItem = item.product_type === 'SERVICIO DE BOMBEO';
        const hasOldPumpService = item.has_pump_service === true && 
          item.pump_price !== null && Number(item.pump_price) > 0 &&
          item.pump_volume !== null && Number(item.pump_volume) > 0;
        
        // Determine display text and styling
        let pumpDisplay = '';
        let volumeDisplay = '';
        
        if (isPumpServiceItem) {
          // This is a pump service item
          pumpDisplay = `<div>
            <span style="background-color: #E6F6FF; color: #0369A1; padding: 4px 8px; border-radius: 4px; font-size: 14px;">Servicio de Bombeo</span>
            <span style="display: block; margin-top: 4px; font-size: 12px; color: #64748B;">${item.volume} m³</span>
          </div>`;
          volumeDisplay = `<span style="color: #0369A1; font-weight: 500;">${item.volume} m³</span>`;
        } else {
          // This is a concrete item
          volumeDisplay = `${item.volume} m³`;
          
          if (hasOldPumpService) {
            pumpDisplay = `<div>
              <span style="background-color: #E6F6FF; color: #0369A1; padding: 4px 8px; border-radius: 4px; font-size: 14px;">Sí</span>
              <span style="display: block; margin-top: 4px; font-size: 12px; color: #64748B;">${item.pump_volume} m³ @ $${Number(item.pump_price).toFixed(2)}</span>
            </div>`;
          } else {
            pumpDisplay = '<span style="background-color: #F9FAFB; color: #64748B; padding: 4px 8px; border-radius: 4px; font-size: 14px;">No</span>';
          }
        }

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.product_type}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${volumeDisplay}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${pumpDisplay}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${new Date(`2000-01-01T${order.delivery_time}`).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
          })}</td>
          </tr>
        `;
      }).join('');
      
      return `
        <div style="margin-bottom: 30px; border: 1px solid #E2E8F0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); background-color: #FFFFFF; ${statusClass}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="color: #0C4A6E; font-size: 18px; margin: 0;">Pedido: ${order.order_number}</h3>
            <div style="background-color: #F0F9FF; padding: 6px 12px; border-radius: 20px; color: #0369A1; font-size: 14px;">
              ${new Date(`2000-01-01T${order.delivery_time}`).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          
          <div style="display: flex; margin-bottom: 15px; gap: 10px;">
            <div>
              <span style="font-size: 12px; color: #64748B;">Crédito:</span> ${getStatusBadge(order.credit_status, 'credit')}
            </div>
            <div>
              <span style="font-size: 12px; color: #64748B;">Orden:</span> ${getStatusBadge(order.order_status, 'order')}
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <p style="margin: 0; color: #64748B; font-size: 14px;">Cliente</p>
              <p style="margin: 0; font-weight: 500; color: #0F172A;">${order.clients.business_name}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <p style="margin: 0; color: #64748B; font-size: 14px;">Obra</p>
              <p style="margin: 0; font-weight: 500; color: #0F172A;">${order.construction_site}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <p style="margin: 0; color: #64748B; font-size: 14px;">Contacto</p>
              <p style="margin: 0; font-weight: 500; color: #0F172A;">${order.clients.contact_name} (${order.clients.phone})</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <p style="margin: 0; color: #64748B; font-size: 14px;">Factura</p>
              <p style="margin: 0; font-weight: 500; color: #0F172A;">${order.requires_invoice ? 'Sí' : 'No'}</p>
            </div>
          </div>
          
          <h4 style="color: #0C4A6E; font-size: 16px; margin: 0 0 15px 0; border-bottom: 1px solid #E2E8F0; padding-bottom: 10px;">Productos</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background-color: #F8FAFC;">
                <th style="text-align: left; padding: 12px 10px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Tipo</th>
                <th style="text-align: left; padding: 12px 10px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Volumen</th>
                <th style="text-align: left; padding: 12px 10px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Bombeo</th>
                <th style="text-align: left; padding: 12px 10px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Hora</th>
              </tr>
            </thead>
            <tbody>
              ${items}
            </tbody>
          </table>
          
          ${!isFullyApproved ? `
            <div style="margin-top: 20px; padding: 12px; background-color: #FEF2F2; border-radius: 6px; font-size: 14px; color: #B91C1C;">
              <strong>Nota:</strong> Este pedido requiere aprobación adicional antes de ser confirmado para entrega.
            </div>
          ` : ''}
          
          ${order.special_requirements ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 4px;">
              <h4 style="color: #92400E; font-size: 14px; margin: 0 0 8px 0;">Requerimientos Especiales</h4>
              <p style="margin: 0; color: #78350F; font-size: 14px;">${order.special_requirements}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Create summary table HTML
    const summaryTableHtml = `
      <div style="margin: 40px 0; padding: 25px; border-radius: 8px; background-color: #F0F9FF; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #0C4A6E; font-size: 20px; margin: 0 0 20px 0; text-align: center;">Resumen de Pedidos para HOY ${formattedDate}</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 16px; color: #0C4A6E; font-weight: 500; border-bottom: 2px solid #BAE6FD;">Concepto</th>
              <th style="text-align: right; padding: 16px; color: #0C4A6E; font-weight: 500; border-bottom: 2px solid #BAE6FD;">Total</th>
              <th style="text-align: right; padding: 16px; color: #0C4A6E; font-weight: 500; border-bottom: 2px solid #BAE6FD;">Aprobados</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 16px; border-bottom: 1px solid #E0F2FE; color: #0369A1;"><strong>Total de Concreto</strong></td>
              <td style="text-align: right; padding: 16px; border-bottom: 1px solid #E0F2FE; font-size: 18px; font-weight: 600; color: #0C4A6E;">${totalConcreteVolume.toFixed(2)} m³</td>
              <td style="text-align: right; padding: 16px; border-bottom: 1px solid #E0F2FE; font-size: 18px; font-weight: 600; color: #059669;">${totalApprovedConcreteVolume.toFixed(2)} m³</td>
            </tr>
            <tr>
              <td style="padding: 16px; color: #0369A1;"><strong>Total con Servicio de Bombeo</strong></td>
              <td style="text-align: right; padding: 16px; font-size: 18px; font-weight: 600; color: #0C4A6E;">${totalPumpingVolume.toFixed(2)} m³</td>
              <td style="text-align: right; padding: 16px; font-size: 18px; font-weight: 600; color: #059669;">${totalApprovedPumpingVolume.toFixed(2)} m³</td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 20px; padding: 12px; background-color: #F0FDF4; border-radius: 6px; font-size: 14px; color: #166534;">
          <p style="margin: 0;"><strong>Nota:</strong> Los valores en la columna "Aprobados" son los únicos que están confirmados para entrega (con crédito aprobado).</p>
        </div>
      </div>
    `;
    
    // Get email recipients (PLANT_MANAGER, EXECUTIVE, and creators)
    const { data: managerRecipients, error: recipientsError } = await supabase.from('user_profiles').select('email, first_name, last_name, role').in('role', [
      'EXECUTIVE',
      'PLANT_MANAGER',
      'DOSIFICADOR'
    ]);
    if (recipientsError) {
      console.error('Error fetching manager recipients:', recipientsError);
      return new Response(JSON.stringify({
        error: recipientsError.message
      }), {
        status: 400
      });
    }
    // Get creator emails for orders
    let creatorEmails = [];
    for (const order of orders){
      const { data: creator, error: creatorError } = await supabase.from('user_profiles').select('email').eq('id', order.created_by).single();
      if (creator && !creatorError) {
        creatorEmails.push(creator.email);
      }
    }
    // Combine recipient lists and remove duplicates
    const allEmails = Array.from(
      new Set([
        ...managerRecipients.map((r: any) => r.email),
        ...creatorEmails
      ])
    );
    
    console.log(`Recipients: ${allEmails.join(', ')}`);
    console.log(`Orders count: ${orders.length}`);
    
    // Get force flag - if present, will send email even if no orders
    const url = new URL(req.url);
    const forceSend = url.searchParams.get('force') === 'true';
    
    // Check if we should send the email (has orders, or force flag is set)
    const shouldSendEmail = (orders.length > 0 && allEmails.length > 0) || (forceSend && allEmails.length > 0);
    console.log(`Should send email? ${shouldSendEmail} (forceSend: ${forceSend})`);
    
    // Prepare email content with improved styling
    const emailContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Programación de Entregas para HOY</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 600;">Programación de Entregas para HOY</h1>
            <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 18px;">${formattedDate}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            ${orders.length > 0 ? `
              <div style="background-color: #F0F9FF; padding: 15px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0; font-size: 16px; color: #0369A1;">
                  <strong>Se han programado ${orders.length} pedidos para HOY ${formattedDate}</strong>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">
                  (${orders.filter((o: any) => o.credit_status === 'approved' && (o.order_status === 'validated' || o.order_status === 'created')).length} con crédito aprobado y orden validada)
                </p>
              </div>
              
              <div style="margin-bottom: 30px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <div style="flex-grow: 1; height: 1px; background-color: #E2E8F0;"></div>
                  <div style="margin: 0 15px; font-size: 16px; color: #64748B; font-weight: 500;">Leyenda de Estados</div>
                  <div style="flex-grow: 1; height: 1px; background-color: #E2E8F0;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: #ECFDF5; color: #059669; font-weight: 500;">Aprobado</span>
                    <span style="font-size: 14px; color: #64748B;">Crédito aprobado</span>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: #ECFDF5; color: #059669; font-weight: 500;">Validado</span>
                    <span style="font-size: 14px; color: #64748B;">Orden validada</span>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: #FFFBEB; color: #D97706; font-weight: 500;">Pendiente</span>
                    <span style="font-size: 14px; color: #64748B;">En espera de aprobación</span>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: #FEF2F2; color: #DC2626; font-weight: 500;">Rechazado</span>
                    <span style="font-size: 14px; color: #64748B;">No aprobado</span>
                  </div>
                </div>
              </div>
              
              ${ordersHtml}
              ${summaryTableHtml}
            ` : `
              <div style="background-color: #F0F9FF; padding: 40px; border-radius: 8px; text-align: center; margin: 40px 0;">
                <p style="margin: 0; font-size: 18px; color: #0369A1;">No hay pedidos programados para HOY ${formattedDate}.</p>
              </div>
            `}
          </div>
          
          <!-- Footer -->
          <div style="background-color: #F1F5F9; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0;">
            <p style="margin: 0; font-size: 14px; color: #64748B;">
              © ${new Date().getFullYear()} DC Concretos. Todos los derechos reservados.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #94A3B8;">
              Este correo fue enviado automáticamente. Por favor no responda a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Skip sending if no orders or recipients
    if (!shouldSendEmail) {
      console.log('Not sending email - no orders or no recipients');
      return new Response(JSON.stringify({
        success: true,
        message: "No hay pedidos o destinatarios para enviar notificaciones."
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    
    console.log('Attempting to send email via SendGrid');
    
    // Prepare email data with BCC to prevent recipients from seeing each other's emails
    const emailData = {
      personalizations: [{
        to: [{ email: FROM_EMAIL }],
        bcc: allEmails.map(email => ({ email })),
        subject: `Programación de Entregas para HOY - ${formattedDate}`
      }],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `Programación de Entregas para HOY - ${formattedDate}`,
      content: [
        {
          type: "text/html",
          value: emailContent
        }
      ]
    };
    
    // Send email using SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error('Error sending email via SendGrid:', responseText);
      return new Response(JSON.stringify({
        error: 'Failed to send email',
        details: responseText
      }), {
        status: 500
      });
    }
    
    console.log('Email sent successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: `Email sent to ${allEmails.length} recipients for ${orders.length} orders on ${targetDateString}`,
      date: targetDateString,
      totalOrders: orders.length,
      totalRecipients: allEmails.length
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error: any) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}); 