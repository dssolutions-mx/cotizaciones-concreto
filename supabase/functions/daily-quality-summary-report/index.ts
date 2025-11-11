import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * DAILY QUALITY SUMMARY REPORT EDGE FUNCTION
 * 
 * Sends a daily summary of quality activities from the last 24 hours:
 * - Muestreos entered in the system
 * - Essays planned for the period
 * - Essays actually completed (with detailed results)
 * - Essays pending (planned but not completed) with client info
 * 
 * FEATURES:
 * - Rolling 24-hour window (never misses late entries)
 * - Plant-specific emails for quality teams (only their plant's data)
 * - Consolidated email for managers (Juan and Alejandro) with all plants
 * - Detailed essay tables with client, recipe, results, age, date AND time
 * - Visual indicators for completion status
 * - Timezone-aware (Mexico timezone)
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

// Email configuration
const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com";
const FROM_NAME = "SISTEMA DE CALIDAD DC CONCRETOS";

const JUAN_EMAIL = 'juan.aguirre@dssolutions-mx.com';
const ALEJANDRO_EMAIL = 'alejandrodiaz@dcconcretos.com.mx';

// Helper function to format a date/time for display
function formatDateTimeForDisplay(date: Date): string {
  return date.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper to format date and time for tables
function formatDateTimeDisplay(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper to calculate age in days
function calculateAgeDays(fechaMuestreo: string | Date, fechaEnsayo: string | Date): number {
  const muestreo = typeof fechaMuestreo === 'string' ? new Date(fechaMuestreo) : fechaMuestreo;
  const ensayo = typeof fechaEnsayo === 'string' ? new Date(fechaEnsayo) : fechaEnsayo;
  const diffTime = Math.abs(ensayo.getTime() - muestreo.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Function to get quality team managers by plant (without Juan and Alejandro)
async function getQualityTeamByPlant(supabaseClient: any, plantId: string): Promise<string[]> {
  const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('email')
    .in('role', ['QUALITY_TEAM'])
    .eq('is_active', true)
    .eq('plant_id', plantId);
  
  if (error) {
    console.error('Error fetching quality team:', error);
    return [];
  }
  
  return data.map((user: { email: string }) => user.email);
}

serve(async (req) => {
  try {
    // Get optional hours parameter (defaults to 24)
    const url = new URL(req.url);
    const hoursParam = url.searchParams.get('hours');
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24;
    
    if (isNaN(hours) || hours <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid hours parameter, must be a positive number'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Calculate 24-hour window (rolling window from now)
    const now = new Date();
    const windowStart = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    // Format window for display
    const windowStartDisplay = formatDateTimeForDisplay(windowStart);
    const windowEndDisplay = formatDateTimeForDisplay(now);
    
    console.log(`Fetching quality summary for last ${hours} hours: ${windowStartDisplay} to ${windowEndDisplay}`);
    
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Get all plants
    const { data: plantsData, error: plantsError } = await supabase
      .from('plants')
      .select('id, name, code')
      .order('name');
    
    if (plantsError) {
      console.error('Error fetching plants:', plantsError);
      return new Response(JSON.stringify({ error: plantsError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const allPlantsData: any[] = [];
    const results: any[] = [];
    
    // Process each plant and collect data
    for (const plant of plantsData || []) {
      const plantId = plant.id;
      
      // Query 1: Muestreos entered in last 24 hours
      const { data: muestreosData } = await supabase
        .from('muestreos')
        .select('id, created_at')
        .eq('plant_id', plantId)
        .gte('created_at', windowStart.toISOString())
        .lt('created_at', now.toISOString());
      
      // Query 2: Detailed pending essays
      const { data: pendingEssaysData } = await supabase
        .from('muestras')
        .select(`
          id,
          identificacion,
          tipo_muestra,
          fecha_programada_ensayo_ts,
          estado,
          muestreo:muestreo_id (
            id,
            fecha_muestreo,
            fecha_muestreo_ts,
            manual_reference,
            remision:remision_id (
              id,
              remision_number,
              orders:order_id (
                id,
                clients:client_id (
                  id,
                  business_name
                ),
                construction_site
              ),
              recipe:recipe_id (
                id,
                recipe_code,
                strength_fc,
                age_days
              )
            )
          )
        `)
        .eq('plant_id', plantId)
        .gte('fecha_programada_ensayo_ts', windowStart.toISOString())
        .lt('fecha_programada_ensayo_ts', now.toISOString())
        .eq('estado', 'PENDIENTE');
      
      // Query 3: Detailed completed essays
      const { data: completedEssaysWithTs } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          fecha_ensayo_ts,
          carga_kg,
          resistencia_calculada,
          porcentaje_cumplimiento,
          muestra:muestra_id (
            id,
            identificacion,
            tipo_muestra,
            fecha_programada_ensayo_ts,
            muestreo:muestreo_id (
              id,
              fecha_muestreo,
              fecha_muestreo_ts,
              manual_reference,
              remision:remision_id (
                id,
                remision_number,
                orders:order_id (
                  id,
                  clients:client_id (
                    id,
                    business_name
                  ),
                  construction_site
                ),
                recipe:recipe_id (
                  id,
                  recipe_code,
                  strength_fc,
                  age_days
                )
              )
            )
          )
        `)
        .eq('plant_id', plantId)
        .gte('fecha_ensayo_ts', windowStart.toISOString())
        .lt('fecha_ensayo_ts', now.toISOString());
      
      const { data: completedEssaysWithoutTs } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          fecha_ensayo_ts,
          carga_kg,
          resistencia_calculada,
          porcentaje_cumplimiento,
          muestra:muestra_id (
            id,
            identificacion,
            tipo_muestra,
            fecha_programada_ensayo_ts,
            muestreo:muestreo_id (
              id,
              fecha_muestreo,
              fecha_muestreo_ts,
              manual_reference,
              remision:remision_id (
                id,
                remision_number,
                orders:order_id (
                  id,
                  clients:client_id (
                    id,
                    business_name
                  ),
                  construction_site
                ),
                recipe:recipe_id (
                  id,
                  recipe_code,
                  strength_fc,
                  age_days
                )
              )
            )
          )
        `)
        .eq('plant_id', plantId)
        .is('fecha_ensayo_ts', null)
        .gte('created_at', windowStart.toISOString())
        .lt('created_at', now.toISOString());
      
      const completedEssaysData = [
        ...(completedEssaysWithTs || []),
        ...(completedEssaysWithoutTs || [])
      ];
      
      // Calculate metrics
      const muestreosEntered = muestreosData?.length || 0;
      const essaysPlanned = (pendingEssaysData?.length || 0) + completedEssaysData.length;
      const essaysCompleted = completedEssaysData.length;
      const essaysPending = pendingEssaysData?.length || 0;
      
      // Store plant data for consolidated email
      allPlantsData.push({
        plant,
        muestreosEntered,
        essaysPlanned,
        essaysCompleted,
        essaysPending,
        completedEssaysData,
        pendingEssaysData
      });
      
      // Only send plant-specific email if there's activity
      if (muestreosEntered === 0 && essaysPlanned === 0) {
        continue;
      }
      
      // Get recipients for this plant (without Juan and Alejandro)
      const plantRecipients = await getQualityTeamByPlant(supabase, plantId);
      
      if (plantRecipients.length === 0) {
        continue; // Skip if no plant-specific recipients
      }
      
      // Generate detailed tables for plant-specific email
      const completedTableRows = completedEssaysData.map((ensayo: any) => {
        const muestra = ensayo.muestra;
        const muestreo = muestra?.muestreo;
        const remision = muestreo?.remision;
        const client = remision?.orders?.clients?.business_name || 'N/A';
        const recipeCode = remision?.recipe?.recipe_code || 'N/A';
        const strengthFc = remision?.recipe?.strength_fc || 'N/A';
        const remisionNumber = remision?.remision_number || muestreo?.manual_reference || 'N/A';
        const fechaEnsayo = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
        const fechaMuestreo = muestreo?.fecha_muestreo_ts || muestreo?.fecha_muestreo;
        const ageDays = fechaMuestreo && fechaEnsayo ? calculateAgeDays(fechaMuestreo, fechaEnsayo) : 'N/A';
        const resistencia = ensayo.resistencia_calculada?.toFixed(2) || 'N/A';
        const cumplimiento = ensayo.porcentaje_cumplimiento?.toFixed(1) || 'N/A';
        const cumplimientoColor = ensayo.porcentaje_cumplimiento >= 100 ? '#059669' : ensayo.porcentaje_cumplimiento >= 90 ? '#F59E0B' : '#DC2626';
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra?.identificacion || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra?.tipo_muestra || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${client}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${recipeCode}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${strengthFc}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${ageDays}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${resistencia}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: ${cumplimientoColor};">${cumplimiento}%</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${remisionNumber}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${formatDateTimeDisplay(fechaEnsayo)}</td>
          </tr>
        `;
      }).join('');
      
      const pendingTableRows = (pendingEssaysData || []).map((muestra: any) => {
        const muestreo = muestra.muestreo;
        const remision = muestreo?.remision;
        const client = remision?.orders?.clients?.business_name || 'N/A';
        const recipeCode = remision?.recipe?.recipe_code || 'N/A';
        const strengthFc = remision?.recipe?.strength_fc || 'N/A';
        const remisionNumber = remision?.remision_number || muestreo?.manual_reference || 'N/A';
        const fechaProgramada = muestra.fecha_programada_ensayo_ts;
        const fechaMuestreo = muestreo?.fecha_muestreo_ts || muestreo?.fecha_muestreo;
        const ageDays = fechaMuestreo && fechaProgramada ? calculateAgeDays(fechaMuestreo, fechaProgramada) : 'N/A';
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra.identificacion || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra.tipo_muestra || 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${client}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${recipeCode}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${strengthFc}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${ageDays}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #DC2626; font-weight: 600;">PENDIENTE</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #DC2626; font-weight: 600;">-</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${remisionNumber}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #DC2626; font-weight: 600;">${formatDateTimeDisplay(fechaProgramada)}</td>
          </tr>
        `;
      }).join('');
      
      const completionRate = essaysPlanned > 0 
        ? Math.round((essaysCompleted / essaysPlanned) * 100)
        : 100;
      
      // Generate email content for this plant (plant-specific only)
      const emailContent = generatePlantEmailContent(
        plant,
        hours,
        windowStartDisplay,
        windowEndDisplay,
        muestreosEntered,
        essaysPlanned,
        essaysCompleted,
        essaysPending,
        completionRate,
        completedTableRows,
        pendingTableRows
      );
      
      // Send email for this plant (only to plant team, not Juan/Alejandro)
      const emailData = {
        personalizations: [{
          to: plantRecipients.map(email => ({ email })),
          subject: `📊 Resumen de Calidad ${plant.name} - Últimas ${hours} horas`
        }],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: `📊 Resumen de Calidad ${plant.name} - Últimas ${hours} horas`,
        content: [
          {
            type: "text/html",
            value: emailContent
          }
        ]
      };
      
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
        console.error(`Error sending email for plant ${plant.name}:`, responseText);
        results.push({ plant: plant.name, success: false, error: responseText });
      } else {
        console.log(`Plant-specific email sent successfully for ${plant.name} to ${plantRecipients.length} recipients`);
        results.push({
          plant: plant.name,
          success: true,
          recipients: plantRecipients.length,
          type: 'plant-specific'
        });
      }
    }
    
    // Generate consolidated email for Juan and Alejandro with all plants
    const consolidatedEmailContent = generateConsolidatedEmailContent(
      allPlantsData,
      hours,
      windowStartDisplay,
      windowEndDisplay
    );
    
    // Send consolidated email to Juan and Alejandro
    const consolidatedEmailData = {
      personalizations: [{
        to: [{ email: JUAN_EMAIL }, { email: ALEJANDRO_EMAIL }],
        subject: `📊 Resumen General de Calidad - Últimas ${hours} horas`
      }],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `📊 Resumen General de Calidad - Últimas ${hours} horas`,
      content: [
        {
          type: "text/html",
          value: consolidatedEmailContent
        }
      ]
    };
    
    const consolidatedResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(consolidatedEmailData)
    });
    
    if (!consolidatedResponse.ok) {
      const responseText = await consolidatedResponse.text();
      console.error('Error sending consolidated email:', responseText);
      results.push({ plant: 'CONSOLIDATED', success: false, error: responseText });
    } else {
      console.log('Consolidated email sent successfully to Juan and Alejandro');
      results.push({
        plant: 'CONSOLIDATED',
        success: true,
        recipients: 2,
        type: 'consolidated'
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Quality summaries processed: ${results.filter(r => r.type === 'plant-specific').length} plant-specific emails + 1 consolidated email`,
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      results: results
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error('Unhandled error in quality summary function:', error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

// Helper function to generate plant-specific email content
function generatePlantEmailContent(
  plant: any,
  hours: number,
  windowStartDisplay: string,
  windowEndDisplay: string,
  muestreosEntered: number,
  essaysPlanned: number,
  essaysCompleted: number,
  essaysPending: number,
  completionRate: number,
  completedTableRows: string,
  pendingTableRows: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resumen Diario de Calidad - ${plant.name}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155;">
      <div style="max-width: 1200px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 600;">📊 Resumen Diario de Calidad</h1>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 18px; font-weight: 600;">${plant.name}</p>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 16px;">Últimas ${hours} horas</p>
          <p style="color: #BAE6FD; margin: 5px 0 0 0; font-size: 14px;">${windowStartDisplay} - ${windowEndDisplay}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <!-- Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div style="text-align: center; padding: 20px; background-color: #F0F9FF; border-radius: 8px; border-left: 4px solid #0369A1;">
              <h3 style="color: #0369A1; font-size: 32px; margin: 0;">${muestreosEntered}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Muestreos</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: #F0F9FF; border-radius: 8px; border-left: 4px solid #0369A1;">
              <h3 style="color: #0369A1; font-size: 32px; margin: 0;">${essaysPlanned}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Programados</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: #F0FDF4; border-radius: 8px; border-left: 4px solid #059669;">
              <h3 style="color: #059669; font-size: 32px; margin: 0;">${essaysCompleted}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Completados</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: ${essaysPending > 0 ? '#FEE2E2' : '#F3F4F6'}; border-radius: 8px; border-left: 4px solid ${essaysPending > 0 ? '#DC2626' : '#64748B'};">
              <h3 style="color: ${essaysPending > 0 ? '#DC2626' : '#64748B'}; font-size: 32px; margin: 0;">${essaysPending}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Pendientes</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: ${completionRate >= 90 ? '#F0FDF4' : completionRate >= 70 ? '#FFFBEB' : '#FEE2E2'}; border-radius: 8px; border-left: 4px solid ${completionRate >= 90 ? '#059669' : completionRate >= 70 ? '#F59E0B' : '#DC2626'};">
              <h3 style="color: ${completionRate >= 90 ? '#059669' : completionRate >= 70 ? '#F59E0B' : '#DC2626'}; font-size: 32px; margin: 0;">${completionRate}%</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Completitud</p>
            </div>
          </div>
          
          ${completedTableRows ? `
            <div style="margin: 30px 0;">
              <h2 style="color: #0C4A6E; font-size: 22px; margin: 0 0 15px 0;">✅ Ensayos Completados (${essaysCompleted})</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: white; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #0F172A;">
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Muestra</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Tipo</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Cliente</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Fórmula</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">f'c</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Edad</th>
                      <th style="text-align: right; padding: 12px; color: white; font-weight: 500;">Resistencia</th>
                      <th style="text-align: right; padding: 12px; color: white; font-weight: 500;">Cumplimiento</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Remisión</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Fecha y Hora Ensayo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${completedTableRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
          
          ${essaysPending > 0 ? `
            <div style="margin: 30px 0;">
              <h2 style="color: #DC2626; font-size: 22px; margin: 0 0 15px 0;">⚠️ Ensayos Pendientes (${essaysPending})</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: white; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #DC2626;">
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Muestra</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Tipo</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Cliente</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Fórmula</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">f'c</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Edad</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Estado</th>
                      <th style="text-align: center; padding: 12px; color: white; font-weight: 500;">Resultado</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Remisión</th>
                      <th style="text-align: left; padding: 12px; color: white; font-weight: 500;">Fecha y Hora Programada</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pendingTableRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
          
          ${essaysPending > 0 ? `
            <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; border-left: 4px solid #DC2626; margin-top: 30px;">
              <h3 style="color: #991B1B; margin: 0 0 10px 0;">⚠️ Atención Requerida</h3>
              <p style="color: #7F1D1D; margin: 0;">
                Hay <strong>${essaysPending} ensayo${essaysPending > 1 ? 's' : ''} pendiente${essaysPending > 1 ? 's' : ''}</strong> que ${essaysPending > 1 ? 'fueron' : 'fue'} programado${essaysPending > 1 ? 's' : ''} pero no ${essaysPending > 1 ? 'fueron' : 'fue'} completado${essaysPending > 1 ? 's' : ''} en el período reportado. 
                Por favor, revisar y completar estos ensayos lo antes posible.
              </p>
            </div>
          ` : `
            <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin-top: 30px;">
              <h3 style="color: #166534; margin: 0 0 10px 0;">✅ Excelente Trabajo</h3>
              <p style="color: #166534; margin: 0;">
                Todos los ensayos programados para el período fueron completados exitosamente.
              </p>
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
}

// Helper function to generate consolidated email content for managers
function generateConsolidatedEmailContent(
  allPlantsData: any[],
  hours: number,
  windowStartDisplay: string,
  windowEndDisplay: string
): string {
  // Calculate totals
  const totals = allPlantsData.reduce((acc, plantData) => ({
    muestreosEntered: acc.muestreosEntered + plantData.muestreosEntered,
    essaysPlanned: acc.essaysPlanned + plantData.essaysPlanned,
    essaysCompleted: acc.essaysCompleted + plantData.essaysCompleted,
    essaysPending: acc.essaysPending + plantData.essaysPending
  }), { muestreosEntered: 0, essaysPlanned: 0, essaysCompleted: 0, essaysPending: 0 });
  
  const overallCompletionRate = totals.essaysPlanned > 0 
    ? Math.round((totals.essaysCompleted / totals.essaysPlanned) * 100)
    : 100;
  
  // Generate plant sections
  const plantSections = allPlantsData.map(plantData => {
    const { plant, muestreosEntered, essaysPlanned, essaysCompleted, essaysPending, completedEssaysData, pendingEssaysData } = plantData;
    const completionRate = essaysPlanned > 0 
      ? Math.round((essaysCompleted / essaysPlanned) * 100)
      : 100;
    
    // Generate tables for this plant
    const completedTableRows = completedEssaysData.map((ensayo: any) => {
      const muestra = ensayo.muestra;
      const muestreo = muestra?.muestreo;
      const remision = muestreo?.remision;
      const client = remision?.orders?.clients?.business_name || 'N/A';
      const recipeCode = remision?.recipe?.recipe_code || 'N/A';
      const strengthFc = remision?.recipe?.strength_fc || 'N/A';
      const remisionNumber = remision?.remision_number || muestreo?.manual_reference || 'N/A';
      const fechaEnsayo = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
      const fechaMuestreo = muestreo?.fecha_muestreo_ts || muestreo?.fecha_muestreo;
      const ageDays = fechaMuestreo && fechaEnsayo ? calculateAgeDays(fechaMuestreo, fechaEnsayo) : 'N/A';
      const resistencia = ensayo.resistencia_calculada?.toFixed(2) || 'N/A';
      const cumplimiento = ensayo.porcentaje_cumplimiento?.toFixed(1) || 'N/A';
      const cumplimientoColor = ensayo.porcentaje_cumplimiento >= 100 ? '#059669' : ensayo.porcentaje_cumplimiento >= 90 ? '#F59E0B' : '#DC2626';
      
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra?.identificacion || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra?.tipo_muestra || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${client}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${recipeCode}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${strengthFc}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${ageDays}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${resistencia}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: ${cumplimientoColor};">${cumplimiento}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${remisionNumber}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${formatDateTimeDisplay(fechaEnsayo)}</td>
        </tr>
      `;
    }).join('');
    
    const pendingTableRows = (pendingEssaysData || []).map((muestra: any) => {
      const muestreo = muestra.muestreo;
      const remision = muestreo?.remision;
      const client = remision?.orders?.clients?.business_name || 'N/A';
      const recipeCode = remision?.recipe?.recipe_code || 'N/A';
      const strengthFc = remision?.recipe?.strength_fc || 'N/A';
      const remisionNumber = remision?.remision_number || muestreo?.manual_reference || 'N/A';
      const fechaProgramada = muestra.fecha_programada_ensayo_ts;
      const fechaMuestreo = muestreo?.fecha_muestreo_ts || muestreo?.fecha_muestreo;
      const ageDays = fechaMuestreo && fechaProgramada ? calculateAgeDays(fechaMuestreo, fechaProgramada) : 'N/A';
      
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra.identificacion || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${muestra.tipo_muestra || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${client}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${recipeCode}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${strengthFc}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${ageDays}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #DC2626; font-weight: 600;">PENDIENTE</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #DC2626; font-weight: 600;">-</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${remisionNumber}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #DC2626; font-weight: 600;">${formatDateTimeDisplay(fechaProgramada)}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div style="margin: 30px 0; border: 2px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0F172A; padding: 20px; color: white;">
          <h2 style="margin: 0; font-size: 22px;">${plant.name}</h2>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-top: 15px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 600; color: #BAE6FD;">${muestreosEntered}</div>
              <div style="font-size: 12px; color: #94A3B8;">Muestreos</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 600; color: #BAE6FD;">${essaysPlanned}</div>
              <div style="font-size: 12px; color: #94A3B8;">Programados</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 600; color: #34D399;">${essaysCompleted}</div>
              <div style="font-size: 12px; color: #94A3B8;">Completados</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 600; color: ${essaysPending > 0 ? '#FCA5A5' : '#94A3B8'};">
                ${essaysPending}
              </div>
              <div style="font-size: 12px; color: #94A3B8;">Pendientes</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 600; color: ${completionRate >= 90 ? '#34D399' : completionRate >= 70 ? '#FCD34D' : '#FCA5A5'};">
                ${completionRate}%
              </div>
              <div style="font-size: 12px; color: #94A3B8;">Completitud</div>
            </div>
          </div>
        </div>
        
        <div style="padding: 20px; background-color: white;">
          ${completedTableRows ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #0C4A6E; font-size: 18px; margin: 0 0 12px 0;">✅ Ensayos Completados (${essaysCompleted})</h3>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="background-color: #F8FAFC;">
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Muestra</th>
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Tipo</th>
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Cliente</th>
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Fórmula</th>
                      <th style="text-align: center; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">f'c</th>
                      <th style="text-align: center; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Edad</th>
                      <th style="text-align: right; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Resistencia</th>
                      <th style="text-align: right; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Cumplimiento</th>
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Remisión</th>
                      <th style="text-align: left; padding: 10px; color: #64748B; font-weight: 600; border-bottom: 2px solid #E2E8F0;">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${completedTableRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
          
          ${essaysPending > 0 ? `
            <div>
              <h3 style="color: #DC2626; font-size: 18px; margin: 0 0 12px 0;">⚠️ Ensayos Pendientes (${essaysPending})</h3>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="background-color: #FEE2E2;">
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Muestra</th>
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Tipo</th>
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Cliente</th>
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Fórmula</th>
                      <th style="text-align: center; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">f'c</th>
                      <th style="text-align: center; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Edad</th>
                      <th style="text-align: center; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Estado</th>
                      <th style="text-align: center; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Resultado</th>
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Remisión</th>
                      <th style="text-align: left; padding: 10px; color: #991B1B; font-weight: 600; border-bottom: 2px solid #DC2626;">Fecha y Hora Programada</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pendingTableRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
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
      <title>Resumen General de Calidad</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155;">
      <div style="max-width: 1400px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 600;">📊 Resumen General de Calidad</h1>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 18px; font-weight: 600;">Todas las Plantas</p>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 16px;">Últimas ${hours} horas</p>
          <p style="color: #BAE6FD; margin: 5px 0 0 0; font-size: 14px;">${windowStartDisplay} - ${windowEndDisplay}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <!-- Overall Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div style="text-align: center; padding: 20px; background-color: #F0F9FF; border-radius: 8px; border-left: 4px solid #0369A1;">
              <h3 style="color: #0369A1; font-size: 32px; margin: 0;">${totals.muestreosEntered}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Muestreos Totales</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: #F0F9FF; border-radius: 8px; border-left: 4px solid #0369A1;">
              <h3 style="color: #0369A1; font-size: 32px; margin: 0;">${totals.essaysPlanned}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Ensayos Programados</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: #F0FDF4; border-radius: 8px; border-left: 4px solid #059669;">
              <h3 style="color: #059669; font-size: 32px; margin: 0;">${totals.essaysCompleted}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Ensayos Completados</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: ${totals.essaysPending > 0 ? '#FEE2E2' : '#F3F4F6'}; border-radius: 8px; border-left: 4px solid ${totals.essaysPending > 0 ? '#DC2626' : '#64748B'};">
              <h3 style="color: ${totals.essaysPending > 0 ? '#DC2626' : '#64748B'}; font-size: 32px; margin: 0;">${totals.essaysPending}</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Ensayos Pendientes</p>
            </div>
            <div style="text-align: center; padding: 20px; background-color: ${overallCompletionRate >= 90 ? '#F0FDF4' : overallCompletionRate >= 70 ? '#FFFBEB' : '#FEE2E2'}; border-radius: 8px; border-left: 4px solid ${overallCompletionRate >= 90 ? '#059669' : overallCompletionRate >= 70 ? '#F59E0B' : '#DC2626'};">
              <h3 style="color: ${overallCompletionRate >= 90 ? '#059669' : overallCompletionRate >= 70 ? '#F59E0B' : '#DC2626'}; font-size: 32px; margin: 0;">${overallCompletionRate}%</h3>
              <p style="color: #64748B; margin: 5px 0 0 0; font-weight: 500;">Tasa General</p>
            </div>
          </div>
          
          ${plantSections}
          
          ${totals.essaysPending > 0 ? `
            <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; border-left: 4px solid #DC2626; margin-top: 30px;">
              <h3 style="color: #991B1B; margin: 0 0 10px 0;">⚠️ Atención Requerida</h3>
              <p style="color: #7F1D1D; margin: 0;">
                Hay <strong>${totals.essaysPending} ensayo${totals.essaysPending > 1 ? 's' : ''} pendiente${totals.essaysPending > 1 ? 's' : ''}</strong> en total que ${totals.essaysPending > 1 ? 'fueron' : 'fue'} programado${totals.essaysPending > 1 ? 's' : ''} pero no ${totals.essaysPending > 1 ? 'fueron' : 'fue'} completado${totals.essaysPending > 1 ? 's' : ''} en el período reportado. 
                Por favor, revisar y completar estos ensayos lo antes posible.
              </p>
            </div>
          ` : `
            <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin-top: 30px;">
              <h3 style="color: #166534; margin: 0 0 10px 0;">✅ Excelente Trabajo</h3>
              <p style="color: #166534; margin: 0;">
                Todos los ensayos programados para el período fueron completados exitosamente en todas las plantas.
              </p>
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
}
