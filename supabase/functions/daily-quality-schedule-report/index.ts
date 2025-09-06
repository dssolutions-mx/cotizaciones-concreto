import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * DAILY QUALITY SCHEDULE REPORT EDGE FUNCTION
 * 
 * Sends a daily report of all concrete samples scheduled for testing tomorrow
 * to help quality teams plan their testing workload.
 * 
 * FEATURES:
 * - Plant-specific targeting (ONLY quality team for relevant plants)
 * - Timezone-aware scheduling (Mexico/local time)
 * - Detailed sample information (client, formula, age, type)
 * - Summary statistics by plant and sample type
 * - Juan is always included in notifications
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

// Email configuration
const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com";
const FROM_NAME = "SISTEMA DE CALIDAD DC CONCRETOS";

// Timezone offset for Mexico (GMT-6)
const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000; // -6 hours in milliseconds

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

// Enhanced function to get ONLY quality team recipients (no executives)
async function getQualityTeamByPlant(supabaseClient: any, plantId: string): Promise<string[]> {
  const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', ['QUALITY_TEAM']) // REMOVED: PLANT_MANAGER, only quality-specific roles
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching quality team for plant:', plantId, error);
    return [];
  }
  
  const plantEmails = data.map((user: { email: string }) => user.email);
  
  // Always add Juan and Alejandro to quality notifications
  const juanEmail = 'juan.aguirre@dssolutions-mx.com';
  const alejandroEmail = 'alejandrodiaz@dcconcretos.com.mx';
  
  if (!plantEmails.includes(juanEmail)) {
    plantEmails.push(juanEmail);
  }
  if (!plantEmails.includes(alejandroEmail)) {
    plantEmails.push(alejandroEmail);
  }
  
  return plantEmails;
}

serve(async (req) => {
  try {
    // Try to get date from request parameters or default to tomorrow in Mexico's timezone
    let targetDate;
    let targetDateString;
    
    try {
      const url = new URL(req.url);
      const dateParam = url.searchParams.get('date');
      
      if (dateParam) {
        // Use the provided date param (format: YYYY-MM-DD)
        const [year, month, day] = dateParam.split('-').map(num => parseInt(num, 10));
        
        if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new Error('Invalid date format, use YYYY-MM-DD');
        }
        
        targetDate = new Date(year, month - 1, day, 12, 0, 0);
        targetDateString = formatDateForDB(targetDate);
      } else {
        // Default to tomorrow in Mexico's timezone
        const mexicoToday = getMexicoDate();
        const mexicoTomorrow = new Date(mexicoToday);
        mexicoTomorrow.setDate(mexicoTomorrow.getDate() + 1);
        targetDate = mexicoTomorrow;
        targetDateString = formatDateForDB(mexicoTomorrow);
      }
      
      console.log(`Using target date for quality tests: ${targetDateString} (Mexico time)`);
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
    
    console.log(`Fetching concrete samples for testing on: ${targetDateString}`);
    
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Get all samples scheduled for testing on target date
    const { data: samples, error: samplesError } = await supabase
      .from('muestras')
      .select(`
        id,
        identificacion,
        tipo_muestra,
        fecha_programada_ensayo_ts,
        event_timezone,
        plant_id,
        estado,
        created_at,
        plants!inner(id, name),
        muestreo:muestreo_id (
          id,
          fecha_muestreo,
          hora_muestreo,
          planta,
          manual_reference,
          remision:remision_id (
            id,
            remision_number,
            recipe:recipe_id (
              id,
              recipe_code,
              strength_fc,
              age_days
            ),
            orders:order_id (
              id,
              clients:client_id (
                id,
                business_name
              )
            )
          )
        )
      `)
      .gte('fecha_programada_ensayo_ts', targetDateString + 'T00:00:00Z')
      .lt('fecha_programada_ensayo_ts', targetDateString + 'T23:59:59Z')
      .eq('estado', 'PENDIENTE')
      .order('fecha_programada_ensayo_ts', { ascending: true });
    
    if (samplesError) {
      console.error('Error fetching samples:', samplesError);
      return new Response(JSON.stringify({
        error: samplesError.message
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log(`Found ${samples.length} samples scheduled for testing on ${targetDateString}`);
    
    // Group samples by plant
    const samplesByPlant = new Map();
    let totalSamples = 0;
    const sampleTypeCounts = { 'CILINDRO': 0, 'VIGA': 0, 'CUBO': 0 };
    
    samples.forEach(sample => {
      const plantId = sample.plant_id;
      const plantName = sample.plants?.name || 'Planta Desconocida';
      
      if (!samplesByPlant.has(plantId)) {
        samplesByPlant.set(plantId, {
          plantName,
          samples: [],
          counts: { 'CILINDRO': 0, 'VIGA': 0, 'CUBO': 0 }
        });
      }
      
      samplesByPlant.get(plantId).samples.push(sample);
      samplesByPlant.get(plantId).counts[sample.tipo_muestra]++;
      sampleTypeCounts[sample.tipo_muestra]++;
      totalSamples++;
    });
    
    // Generate summary statistics
    const plantSummary = Array.from(samplesByPlant.entries()).map(([plantId, data]) => ({
      plantId,
      plantName: data.plantName,
      totalSamples: data.samples.length,
      cilindros: data.counts.CILINDRO,
      vigas: data.counts.VIGA,
      cubos: data.counts.CUBO
    }));
    
    // Get force flag
    const url = new URL(req.url);
    const forceSend = url.searchParams.get('force') === 'true';
    
    // Only proceed if we have samples or force flag is set
    if (totalSamples === 0 && !forceSend) {
      console.log('No samples scheduled for testing tomorrow - not sending email');
      return new Response(JSON.stringify({
        success: true,
        message: "No hay muestras programadas para ensayo mañana."
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Generate HTML content for each plant
    let plantReportsHtml = '';
    let allRecipients = new Set();
    
    for (const [plantId, plantData] of samplesByPlant) {
      const recipients = await getQualityTeamByPlant(supabase, plantId);
      recipients.forEach(email => allRecipients.add(email));
      
      const samplesHtml = plantData.samples.map(sample => {
        const testTime = new Date(sample.fecha_programada_ensayo_ts);
        const timeLocal = testTime.toLocaleTimeString('es-MX', {
          timeZone: sample.event_timezone || 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Determine if we have a valid remision or should use manual_reference
        const hasRemision = sample.muestreo?.remision && sample.muestreo.remision.id !== null;
        const displayClient = hasRemision
          ? sample.muestreo.remision.orders?.clients?.business_name || 'N/D'
          : 'Manual';
        const displayFormula = hasRemision
          ? sample.muestreo.remision.recipe?.recipe_code || 'N/D'
          : 'Manual';
        const displayStrength = hasRemision
          ? sample.muestreo.remision.recipe?.strength_fc || 'N/D'
          : 'N/D';
        const displayAge = hasRemision
          ? sample.muestreo.remision.recipe?.age_days || 'N/D'
          : 'N/D';
        const displayReference = hasRemision
          ? sample.muestreo.remision.remision_number || 'N/D'
          : sample.muestreo?.manual_reference || 'N/D';

        // Format sampling date and time
        const displaySamplingDateTime = sample.muestreo?.fecha_muestreo && sample.muestreo?.hora_muestreo
          ? `${new Date(sample.muestreo.fecha_muestreo).toLocaleDateString('es-MX')} ${sample.muestreo.hora_muestreo}`
          : sample.muestreo?.fecha_muestreo
            ? `${new Date(sample.muestreo.fecha_muestreo).toLocaleDateString('es-MX')} (hora no especificada)`
            : 'Fecha de muestreo no disponible';

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${sample.identificacion}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${sample.tipo_muestra}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #0369A1;">${timeLocal}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${displaySamplingDateTime}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${displayClient}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${displayFormula}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${displayStrength}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center;">${displayAge}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${displayReference}</td>
          </tr>
        `;
      }).join('');
      
      plantReportsHtml += `
        <div style="margin: 30px 0; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
          <div style="background-color: #0F172A; padding: 20px; color: white;">
            <h2 style="margin: 0; font-size: 20px;">${plantData.plantName}</h2>
            <p style="margin: 8px 0 0 0; color: #BAE6FD;">
              ${plantData.samples.length} muestras programadas • 
              ${plantData.counts.CILINDRO} cilindros • 
              ${plantData.counts.VIGA} vigas • 
              ${plantData.counts.CUBO} cubos
            </p>
          </div>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #F8FAFC;">
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Identificación</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Tipo</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Hora</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Fecha/Hora Muestreo</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Cliente</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Fórmula</th>
                  <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">f'c (kg/cm²)</th>
                  <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Edad (días)</th>
                  <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Referencia</th>
                </tr>
              </thead>
              <tbody>
                ${samplesHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
    // Create summary section
    const summaryHtml = `
      <div style="margin: 40px 0; padding: 25px; border-radius: 8px; background-color: #F0F9FF; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #0C4A6E; font-size: 22px; margin: 0 0 20px 0; text-align: center;">Resumen de Ensayos para ${formattedDate}</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
            <h3 style="color: #DC2626; font-size: 28px; margin: 0;">${totalSamples}</h3>
            <p style="color: #64748B; margin: 5px 0 0 0;">Total Muestras</p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
            <h3 style="color: #0369A1; font-size: 28px; margin: 0;">${sampleTypeCounts.CILINDRO}</h3>
            <p style="color: #64748B; margin: 5px 0 0 0;">Cilindros</p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
            <h3 style="color: #059669; font-size: 28px; margin: 0;">${sampleTypeCounts.VIGA}</h3>
            <p style="color: #64748B; margin: 5px 0 0 0;">Vigas</p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: white; border-radius: 6px;">
            <h3 style="color: #D97706; font-size: 28px; margin: 0;">${sampleTypeCounts.CUBO}</h3>
            <p style="color: #64748B; margin: 5px 0 0 0;">Cubos</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; background-color: white; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #0F172A;">
              <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Planta</th>
              <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Total</th>
              <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Cilindros</th>
              <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Vigas</th>
              <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Cubos</th>
            </tr>
          </thead>
          <tbody>
            ${plantSummary.map(plant => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${plant.plantName}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #DC2626;">${plant.totalSamples}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0; color: #0369A1;">${plant.cilindros}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0; color: #059669;">${plant.vigas}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0; color: #D97706;">${plant.cubos}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    // Prepare email content
    const emailContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Programa de Ensayos de Calidad</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155;">
        <div style="max-width: 1000px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 600;">🔬 Programa de Ensayos de Calidad</h1>
            <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 18px;">${formattedDate}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            ${totalSamples > 0 ? `
              <div style="background-color: #F0F9FF; padding: 15px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
                <p style="margin: 0; font-size: 16px; color: #0369A1;">
                  <strong>📋 ${totalSamples} muestras programadas para ensayo mañana ${formattedDate}</strong>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">
                  Distribución: ${sampleTypeCounts.CILINDRO} cilindros • ${sampleTypeCounts.VIGA} vigas • ${sampleTypeCounts.CUBO} cubos
                </p>
              </div>
              
              ${summaryHtml}
              ${plantReportsHtml}
              
              <div style="background-color: #FFFBEB; padding: 20px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-top: 30px;">
                <h3 style="color: #92400E; margin: 0 0 10px 0;">⚠️ Recordatorios Importantes</h3>
                <ul style="color: #78350F; margin: 0; padding-left: 20px;">
                  <li>Verificar equipos y calibración antes del inicio</li>
                  <li>Preparar los moldes y herramientas necesarias</li>
                  <li>Confirmar disponibilidad de personal de laboratorio</li>
                  <li>Los tiempos de ensayo son críticos - diferencias de 30+ minutos afectan resultados</li>
                </ul>
              </div>
            ` : `
              <div style="background-color: #F0F9FF; padding: 40px; border-radius: 8px; text-align: center; margin: 40px 0;">
                <p style="margin: 0; font-size: 18px; color: #0369A1;">✅ No hay muestras programadas para ensayo mañana ${formattedDate}.</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748B;">El equipo de calidad puede enfocar en otras actividades.</p>
              </div>
            `}
          </div>
          
          <!-- Footer -->
          <div style="background-color: #F1F5F9; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0;">
            <p style="margin: 0; font-size: 14px; color: #64748B;">
              © ${new Date().getFullYear()} DC Concretos - Sistema de Calidad. Todos los derechos reservados.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #94A3B8;">
              Este correo fue enviado automáticamente. Por favor no responda a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Convert recipients set to array
    const recipientEmails = Array.from(allRecipients);
    
    // Always ensure Juan gets the summary even if no plant-specific samples
    if (!recipientEmails.includes(FROM_EMAIL)) {
      recipientEmails.push(FROM_EMAIL);
    }
    
    console.log(`Sending quality schedule to: ${recipientEmails.join(', ')}`);
    
    // Prepare email data
    const emailData = {
      personalizations: [{
        to: recipientEmails.map(email => ({ email })),
        subject: `🔬 Programa de Ensayos - ${formattedDate}`
      }],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `🔬 Programa de Ensayos - ${formattedDate}`,
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
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log('Quality schedule email sent successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: `Quality schedule sent to ${recipientEmails.length} recipients for ${totalSamples} samples on ${targetDateString}`,
      date: targetDateString,
      totalSamples: totalSamples,
      totalRecipients: recipientEmails.length,
      plantsSummary: plantSummary
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error('Unhandled error in quality schedule function:', error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
