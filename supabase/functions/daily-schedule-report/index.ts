import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * DAILY SCHEDULE REPORT EDGE FUNCTION - MULTI-PLANT VERSION
 * 
 * This function sends personalized daily schedule reports for ALL plants.
 * Each recipient receives ONE email with orders from plants they have access to.
 * 
 * RECIPIENT LOGIC:
 * - EXECUTIVE: Receives orders from ALL plants
 * - PLANT_MANAGER: Receives orders only from their assigned plant
 * - DOSIFICADOR: Receives orders only from their assigned plant
 * - SALES_AGENT: Receives orders only from their assigned plant (or all if no plant assigned)
 * - EXTERNAL_CLIENT: EXCLUDED from all schedule notifications
 * 
 * FEATURES:
 * - Processes ALL plants in a single run
 * - Sends ONE personalized email per recipient
 * - Groups orders by plant within each email
 * - Excludes external client portal users from notifications
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

// Email configuration
const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com";
const FROM_NAME = "SISTEMA DE GESTION DE PEDIDOS";

// Timezone offset for Mexico (GMT-6)
const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000;

// Types
interface Plant {
  id: string;
  code: string;
  name: string;
}

interface OrderItem {
  id: string;
  product_type: string;
  volume: number;
  unit_price: number;
  has_pump_service: boolean;
  pump_price?: number;
  pump_volume?: number;
  has_empty_truck_charge: boolean;
  empty_truck_volume?: number;
  empty_truck_price?: number;
}

interface Order {
  id: string;
  order_number: string;
  requires_invoice: boolean;
  delivery_time: string;
  delivery_date: string;
  construction_site: string;
  special_requirements?: string;
  created_by: string;
  credit_status: string;
  order_status: string;
  plant_id: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_google_maps_url?: string;
  clients: {
    business_name: string;
    contact_name: string;
    phone: string;
  };
  order_items: OrderItem[];
}

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  plant_id?: string;
  business_unit_id?: string;
}

interface PlantOrders {
  plant: Plant;
  orders: Order[];
  totals: {
    totalConcreteVolume: number;
    totalPumpingVolume: number;
    totalApprovedConcreteVolume: number;
    totalApprovedPumpingVolume: number;
  };
}

// Helper function to get a date in Mexico's timezone
function getMexicoDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
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

// Calculate volumes for orders
function calculateVolumes(orders: Order[]) {
    let totalConcreteVolume = 0;
    let totalPumpingVolume = 0;
    let totalApprovedConcreteVolume = 0;
    let totalApprovedPumpingVolume = 0;
    
    orders.forEach((order) => {
      const isFullyApproved = order.credit_status === 'approved' && 
        (order.order_status === 'validated' || order.order_status === 'created');
      
      order.order_items.forEach((item) => {
        const isPumpServiceItem = item.product_type === 'SERVICIO DE BOMBEO';
        const hasOldPumpService = item.has_pump_service === true && 
          item.pump_price !== null && Number(item.pump_price) > 0 &&
          item.pump_volume !== null && Number(item.pump_volume) > 0;
        
        if (isPumpServiceItem) {
          const pumpVolume = Number(item.volume) || 0;
          totalPumpingVolume += pumpVolume;
          if (isFullyApproved) {
            totalApprovedPumpingVolume += pumpVolume;
          }
        } else {
          const concreteVolume = Number(item.volume) || 0;
          totalConcreteVolume += concreteVolume;
          if (isFullyApproved) {
            totalApprovedConcreteVolume += concreteVolume;
          }
          if (hasOldPumpService) {
            const oldPumpVolume = Number(item.pump_volume) || 0;
            totalPumpingVolume += oldPumpVolume;
            if (isFullyApproved) {
              totalApprovedPumpingVolume += oldPumpVolume;
          }
        }
      }
    });
  });

  return { totalConcreteVolume, totalPumpingVolume, totalApprovedConcreteVolume, totalApprovedPumpingVolume };
}

// Get status badge HTML
function getStatusBadge(status: string, type: string) {
  let color = '#64748B';
      let bgColor = '#F1F5F9';
      let text = status || 'Pendiente';

      if (type === 'credit') {
        if (status === 'approved') {
      color = '#059669'; bgColor = '#ECFDF5'; text = 'Aprobado';
        } else if (status === 'rejected') {
      color = '#DC2626'; bgColor = '#FEF2F2'; text = 'Rechazado';
        } else if (status === 'pending') {
      color = '#D97706'; bgColor = '#FFFBEB'; text = 'Pendiente';
        }
      } else if (type === 'order') {
        if (status === 'validated') {
      color = '#059669'; bgColor = '#ECFDF5'; text = 'Validado';
        } else if (status === 'pending') {
      color = '#D97706'; bgColor = '#FFFBEB'; text = 'Pendiente';
        } else if (status === 'rejected') {
      color = '#DC2626'; bgColor = '#FEF2F2'; text = 'Rechazado';
        }
      }

      return `<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: ${bgColor}; color: ${color}; font-weight: 500;">${text}</span>`;
}

// Generate HTML for a single order
function generateOrderHtml(order: Order) {
  const isFullyApproved = order.credit_status === 'approved' && 
    (order.order_status === 'validated' || order.order_status === 'created');
      const statusClass = isFullyApproved ? '' : 'opacity: 0.85; border-left: 4px solid #FCA5A5;';

      const items = order.order_items.map((item) => {
        const isPumpServiceItem = item.product_type === 'SERVICIO DE BOMBEO';
        const hasOldPumpService = item.has_pump_service === true && 
          item.pump_price !== null && Number(item.pump_price) > 0 &&
          item.pump_volume !== null && Number(item.pump_volume) > 0;
        
        let pumpDisplay = '';
        let volumeDisplay = '';
        
        if (isPumpServiceItem) {
          pumpDisplay = `<div>
            <span style="background-color: #E6F6FF; color: #0369A1; padding: 4px 8px; border-radius: 4px; font-size: 14px;">Servicio de Bombeo</span>
            <span style="display: block; margin-top: 4px; font-size: 12px; color: #64748B;">${item.volume} m³</span>
          </div>`;
          volumeDisplay = `<span style="color: #0369A1; font-weight: 500;">${item.volume} m³</span>`;
        } else {
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
          
          ${(order.delivery_google_maps_url || (order.delivery_latitude && order.delivery_longitude)) ? `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #F0F9FF; border-radius: 8px; border-left: 4px solid #0369A1;">
              <h4 style="color: #0369A1; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">📍 Ubicación de Entrega</h4>
              ${order.delivery_latitude && order.delivery_longitude ? `
                <p style="margin: 0; color: #0C4A6E; font-size: 14px; margin-bottom: 8px;">
                  <strong>Coordenadas:</strong> ${order.delivery_latitude}, ${order.delivery_longitude}
                </p>
              ` : ''}
              ${order.delivery_google_maps_url ? `
            <a href="${order.delivery_google_maps_url}" target="_blank" rel="noopener noreferrer"
               style="display: inline-flex; align-items: center; padding: 8px 16px; background-color: #0369A1; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                  Abrir en Google Maps
                </a>
              ` : ''}
            </div>
          ` : ''}
          
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
}

// Generate summary table HTML for a plant
function generateSummaryHtml(plantName: string, totals: PlantOrders['totals'], formattedDate: string) {
  return `
      <div style="margin: 40px 0; padding: 25px; border-radius: 8px; background-color: #F0F9FF; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
      <h2 style="color: #0C4A6E; font-size: 20px; margin: 0 0 20px 0; text-align: center;">Resumen - ${plantName}</h2>
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
            <td style="text-align: right; padding: 16px; border-bottom: 1px solid #E0F2FE; font-size: 18px; font-weight: 600; color: #0C4A6E;">${totals.totalConcreteVolume.toFixed(2)} m³</td>
            <td style="text-align: right; padding: 16px; border-bottom: 1px solid #E0F2FE; font-size: 18px; font-weight: 600; color: #059669;">${totals.totalApprovedConcreteVolume.toFixed(2)} m³</td>
            </tr>
            <tr>
              <td style="padding: 16px; color: #0369A1;"><strong>Total con Servicio de Bombeo</strong></td>
            <td style="text-align: right; padding: 16px; font-size: 18px; font-weight: 600; color: #0C4A6E;">${totals.totalPumpingVolume.toFixed(2)} m³</td>
            <td style="text-align: right; padding: 16px; font-size: 18px; font-weight: 600; color: #059669;">${totals.totalApprovedPumpingVolume.toFixed(2)} m³</td>
            </tr>
          </tbody>
        </table>
    </div>
  `;
}

// Generate full email content for a recipient
function generateEmailContent(recipientName: string, plantOrdersList: PlantOrders[], formattedDate: string, isForTomorrow: boolean) {
  const totalOrders = plantOrdersList.reduce((sum, po) => sum + po.orders.length, 0);
  const totalApproved = plantOrdersList.reduce((sum, po) => 
    sum + po.orders.filter(o => o.credit_status === 'approved' && (o.order_status === 'validated' || o.order_status === 'created')).length, 0);
  
  const plantNames = plantOrdersList.map(po => po.plant.name).join(', ');
  const dateLabel = isForTomorrow ? 'Mañana' : 'Hoy';

  // Generate content for each plant
  const plantsContent = plantOrdersList.map(po => {
    if (po.orders.length === 0) return '';
    
    const ordersHtml = po.orders.map(order => generateOrderHtml(order)).join('');
    const summaryHtml = generateSummaryHtml(po.plant.name, po.totals, formattedDate);
    
    return `
      <div style="margin-bottom: 40px;">
        <div style="background-color: #0369A1; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h2 style="margin: 0; font-size: 20px;">${po.plant.name}</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${po.orders.length} pedido${po.orders.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 8px 8px; padding: 20px;">
          ${ordersHtml}
          ${summaryHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Programación de Entregas - ${dateLabel}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 600;">Programación de Entregas - ${dateLabel}</h1>
            <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 18px;">${formattedDate}</p>
          <p style="color: #7DD3FC; margin: 5px 0 0 0; font-size: 14px;">Hola, ${recipientName}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
          ${totalOrders > 0 ? `
              <div style="background-color: #F0F9FF; padding: 15px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0; font-size: 16px; color: #0369A1;">
                <strong>Total: ${totalOrders} pedido${totalOrders !== 1 ? 's' : ''} programado${totalOrders !== 1 ? 's' : ''}</strong>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">
                (${totalApproved} con crédito aprobado)
                </p>
              </div>
              
            <!-- Status Legend -->
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
              
            ${plantsContent}
            ` : `
              <div style="background-color: #F0F9FF; padding: 40px; border-radius: 8px; text-align: center; margin: 40px 0;">
                <p style="margin: 0; font-size: 18px; color: #0369A1;">No hay pedidos programados para ${formattedDate}.</p>
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
}

serve(async (req) => {
  try {
    // Parse date parameter
    let targetDate: Date;
    let targetDateString: string;
    let isForTomorrow = true;

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const forceSend = url.searchParams.get('force') === 'true';

    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(num => parseInt(num, 10));
      if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
        return new Response(JSON.stringify({ error: 'Invalid date format, use YYYY-MM-DD' }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      targetDate = new Date(year, month - 1, day, 12, 0, 0);
      targetDateString = formatDateForDB(targetDate);
      
      // Check if it's today or tomorrow
      const today = formatDateForDB(getMexicoDate());
      isForTomorrow = targetDateString !== today;
    } else {
      // Default to tomorrow
      const mexicoToday = getMexicoDate();
      const mexicoTomorrow = new Date(mexicoToday);
      mexicoTomorrow.setDate(mexicoTomorrow.getDate() + 1);
      targetDate = mexicoTomorrow;
      targetDateString = formatDateForDB(mexicoTomorrow);
    }

    const formattedDate = targetDate.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Using target date: ${targetDateString} (Mexico time)`);

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY!);

    // 1. Get all plants
    const { data: plants, error: plantsError } = await supabase
      .from('plants')
      .select('id, code, name')
      .order('code');

    if (plantsError) {
      console.error('Error fetching plants:', plantsError);
      return new Response(JSON.stringify({ error: plantsError.message }), { status: 400 });
    }

    console.log(`Found ${plants.length} plants`);

    // 2. Get ALL orders for target date (excluding cancelled)
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
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
        plant_id,
        delivery_latitude,
        delivery_longitude,
        delivery_google_maps_url,
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
      .neq('order_status', 'cancelled');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(JSON.stringify({ error: ordersError.message }), { status: 400 });
    }

    console.log(`Found ${allOrders.length} total orders for ${targetDateString}`);

    // 3. Group orders by plant
    const ordersByPlant = new Map<string, Order[]>();
    for (const plant of plants) {
      ordersByPlant.set(plant.id, []);
    }
    for (const order of allOrders as Order[]) {
      if (order.plant_id && ordersByPlant.has(order.plant_id)) {
        ordersByPlant.get(order.plant_id)!.push(order);
      }
    }

    // 4. Get eligible recipients (EXCLUDE EXTERNAL_CLIENT role)
    const { data: recipients, error: recipientsError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, role, plant_id, business_unit_id')
      .in('role', ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'SALES_AGENT'])
      .not('role', 'eq', 'EXTERNAL_CLIENT'); // Explicitly exclude external clients

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
      return new Response(JSON.stringify({ error: recipientsError.message }), { status: 400 });
    }

    console.log(`Found ${recipients.length} eligible recipients (excluding EXTERNAL_CLIENT)`);

    // 5. Build personalized emails for each recipient
    const emailsSent: string[] = [];
    const emailErrors: string[] = [];

    for (const recipient of recipients as Recipient[]) {
      // Determine which plants this recipient should see
      let visiblePlantIds: string[] = [];
      
      if (recipient.role === 'EXECUTIVE') {
        // Executives see ALL plants
        visiblePlantIds = plants.map(p => p.id);
      } else if (recipient.plant_id) {
        // Users with a plant_id only see their plant
        visiblePlantIds = [recipient.plant_id];
      } else if (!recipient.plant_id && !recipient.business_unit_id) {
        // Users with no plant/business unit see ALL plants (global access)
        visiblePlantIds = plants.map(p => p.id);
      } else {
        // Users with only business_unit_id - skip for now (no plant assignment)
        continue;
      }

      // Get orders for visible plants
      const plantOrdersList: PlantOrders[] = [];
      for (const plantId of visiblePlantIds) {
        const plant = plants.find(p => p.id === plantId);
        const orders = ordersByPlant.get(plantId) || [];
        
        if (plant && orders.length > 0) {
          plantOrdersList.push({
            plant: plant as Plant,
            orders,
            totals: calculateVolumes(orders)
          });
        }
      }

      // Skip if no orders for this recipient's plants
      if (plantOrdersList.length === 0 && !forceSend) {
        console.log(`Skipping ${recipient.email} - no orders for their plants`);
        continue;
      }

      // Generate personalized email content
      const recipientName = `${recipient.first_name} ${recipient.last_name}`.trim() || 'Usuario';
      const emailContent = generateEmailContent(recipientName, plantOrdersList, formattedDate, isForTomorrow);
      const plantSummary = plantOrdersList.map(po => po.plant.name).join(', ') || 'Sin pedidos';
      const totalOrders = plantOrdersList.reduce((sum, po) => sum + po.orders.length, 0);

      // Prepare email
    const emailData = {
        personalizations: [{
          to: [{ email: recipient.email }],
          subject: `Programación de Entregas ${isForTomorrow ? 'Mañana' : 'Hoy'} - ${formattedDate} (${totalOrders} pedidos)`
        }],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
        content: [{
          type: "text/html",
          value: emailContent
        }]
    };

      // Send email
      try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

        if (response.ok) {
          emailsSent.push(recipient.email);
          console.log(`Email sent to ${recipient.email} (${plantSummary})`);
        } else {
          const errorText = await response.text();
          emailErrors.push(`${recipient.email}: ${errorText}`);
          console.error(`Error sending to ${recipient.email}:`, errorText);
        }
      } catch (sendError: any) {
        emailErrors.push(`${recipient.email}: ${sendError.message}`);
        console.error(`Error sending to ${recipient.email}:`, sendError);
      }
    }

    // Return summary
    return new Response(JSON.stringify({
      success: true,
      date: targetDateString,
      totalOrders: allOrders.length,
      plantsWithOrders: Array.from(ordersByPlant.entries())
        .filter(([_, orders]) => orders.length > 0)
        .map(([plantId, orders]) => ({
          plant: plants.find(p => p.id === plantId)?.name,
          orderCount: orders.length
        })),
      emailsSent: emailsSent.length,
      recipients: emailsSent,
      errors: emailErrors.length > 0 ? emailErrors : undefined
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
