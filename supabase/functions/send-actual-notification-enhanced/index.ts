import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Enhanced function to get plant-specific recipients
// Includes quality team members assigned directly to the plant OR to the plant's business unit
async function getPlantSpecificRecipients(supabaseClient: any, plantId: string): Promise<string[]> {
  // First, get the plant's business_unit_id
  const { data: plantData, error: plantError } = await supabaseClient
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .single();

  if (plantError) {
    console.error('Error fetching plant data:', plantError);
    return [];
  }

  const businessUnitId = plantData?.business_unit_id;

  // Get quality team members directly assigned to the plant
  const { data: plantAssignedUsers, error: plantError2 } = await supabaseClient
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', ['QUALITY_TEAM'])
    .eq('is_active', true);

  if (plantError2) {
    console.error('Error fetching plant-specific recipients:', plantError2);
  }
  
  const plantEmails = (plantAssignedUsers || []).map((user: { email: string }) => user.email);

  // Get quality team members assigned to the business unit (if plant has a business unit)
  if (businessUnitId) {
    const { data: buAssignedUsers, error: buError } = await supabaseClient
      .from('user_profiles')
      .select('email')
      .eq('business_unit_id', businessUnitId)
      .is('plant_id', null) // Only users with business_unit_id and no specific plant_id
      .in('role', ['QUALITY_TEAM'])
      .eq('is_active', true);

    if (buError) {
      console.error('Error fetching quality team for business unit:', buError);
    } else {
      const buEmails = (buAssignedUsers || []).map((user: { email: string }) => user.email);
      // Add business unit emails, avoiding duplicates
      buEmails.forEach((email: string) => {
        if (!plantEmails.includes(email)) {
          plantEmails.push(email);
        }
      });
    }
  }
  
  // Always add Juan and Alejandro to the notifications
  const juanEmail = 'juan.aguirre@dssolutions-mx.com';
  const alejandroEmail = 'alejandrodiaz@dcconcretos.com.mx';
  
  if (!plantEmails.includes(juanEmail)) {
    plantEmails.push(juanEmail);
  }
  if (!plantEmails.includes(alejandroEmail)) {
    plantEmails.push(alejandroEmail);
  }
  
  console.log(`Found ${plantEmails.length} total recipients for plant ${plantId}:`, plantEmails);
  return plantEmails;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const payload = await req.json();
    if (!payload.muestra_id) {
      return new Response(JSON.stringify({
        error: 'Missing muestra_id in payload'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch detailed sample information
    const { data: muestraData, error: muestraError } = await supabaseAdmin
      .from('muestras')
      .select(`
        id,
        identificacion,
        tipo_muestra,
        fecha_programada_ensayo_ts,
        event_timezone,
        plant_id,
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
      .eq('id', payload.muestra_id)
      .single();

    if (muestraError) {
      console.error('Error fetching sample details:', muestraError);
      return new Response(JSON.stringify({
        error: 'Error fetching sample details'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!muestraData) {
      return new Response(JSON.stringify({
        error: 'Sample not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const muestra = muestraData;
    const plantId = payload.plant_id || muestra.plant_id;
    const timezone = payload.timezone_local || muestra.event_timezone || 'America/Mexico_City';

    // Determine if we have a valid remision or should use manual_reference
    const hasRemision = muestra.muestreo?.remision && muestra.muestreo.remision.id !== null;
    const displayReference = hasRemision
      ? muestra.muestreo.remision.remision_number || 'N/D'
      : muestra.muestreo?.manual_reference || 'N/D';
    const displayClient = hasRemision
      ? muestra.muestreo.remision.orders?.clients?.business_name || 'N/D'
      : 'Manual';
    const displayFormula = hasRemision
      ? muestra.muestreo.remision.recipe?.recipe_code || 'N/D'
      : 'Manual';
    const displayStrength = hasRemision
      ? muestra.muestreo.remision.recipe?.strength_fc || 'N/D'
      : 'N/D';
    const displayAge = hasRemision
      ? muestra.muestreo.remision.recipe?.age_days || 'N/D'
      : 'N/D';

    // Format sampling date and time
    const displaySamplingDateTime = muestra.muestreo?.fecha_muestreo && muestra.muestreo?.hora_muestreo
      ? `${new Date(muestra.muestreo.fecha_muestreo).toLocaleDateString('es-MX')} ${muestra.muestreo.hora_muestreo}`
      : muestra.muestreo?.fecha_muestreo
        ? `${new Date(muestra.muestreo.fecha_muestreo).toLocaleDateString('es-MX')} (hora no especificada)`
        : 'Fecha de muestreo no disponible';

    // Get plant-specific recipients (including Juan)
    const recipientEmails = await getPlantSpecificRecipients(supabaseAdmin, plantId);
    
    if (recipientEmails.length === 0) {
      console.warn(`No recipients found for plant ${plantId}, sample: ${muestra.id}`);
      return new Response(JSON.stringify({
        success: true,
        message: `No recipients found for plant ${plantId}, notification not sent.`
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Format the exact test time with timezone awareness
    const testTimeUTC = new Date(muestra.fecha_programada_ensayo_ts);
    const testTimeLocal = testTimeUTC.toLocaleString('es-MX', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const minutesUntilTest = Math.round((testTimeUTC.getTime() - Date.now()) / (1000 * 60));
    const urgencyLevel = minutesUntilTest <= 5 ? '🚨 URGENTE' : '⏰ RECORDATORIO';

    const subject = `${urgencyLevel} - Ensayo en ${minutesUntilTest} min: ${muestra.identificacion}`;

    const bodyHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <div style="background-color: ${minutesUntilTest <= 5 ? '#FEE2E2' : '#FEF3C7'}; border-left: 4px solid ${minutesUntilTest <= 5 ? '#DC2626' : '#F59E0B'}; padding: 20px; margin: 20px 0;">
            <h2 style="color: ${minutesUntilTest <= 5 ? '#DC2626' : '#92400E'}; margin: 0 0 15px 0;">
              ${urgencyLevel} - Ensayo Programado
            </h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="background-color: #F0F9FF; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="color: #0C4A6E; margin: 0 0 10px 0;">⏰ Tiempo Exacto de Ensayo</h3>
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0369A1;">${testTimeLocal}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">
                  <strong>Faltan: ${minutesUntilTest} minutos</strong> | Zona: ${timezone}
                </p>
              </div>
              
              <h3 style="color: #374151; margin: 0 0 15px 0;">📋 Información de la Muestra</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Identificación:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${muestra.identificacion}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Tipo:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${muestra.tipo_muestra}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Cliente:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${displayClient}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Fórmula:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${displayFormula} (f'c ${displayStrength} kg/cm²)</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Edad:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${displayAge} días</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-weight: bold;">Fecha/Hora Muestreo:</td><td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${displaySamplingDateTime}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Remisión:</td><td style="padding: 8px 0;">${displayReference}</td></tr>
              </table>
              
              <div style="background-color: #DBEAFE; padding: 15px; border-radius: 6px; margin-top: 20px;">
                <p style="margin: 0; color: #1E40AF; font-size: 14px;">
                  <strong>IMPORTANTE:</strong> La precisión en el tiempo de ensayo es crítica para la validez de los resultados. 
                  Diferencias de incluso 30 minutos pueden afectar significativamente la resistencia medida.
                </p>
              </div>
            </div>
            
            <div style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <h4 style="color: #374151; margin: 0 0 10px 0;">👥 Destinatarios de esta Notificación:</h4>
              <p style="margin: 0; font-size: 12px; color: #6B7280;">
                ${recipientEmails.join(', ')}
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #F9FAFB; border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color: #6B7280;">
              Sistema Automatizado de Calidad DC Concretos | Planta: ${plantId}<br/>
              Fecha/Hora actual: ${new Date().toLocaleString('es-MX', {
                timeZone: timezone
              })}
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email using SendGrid
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com';

    if (!SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY not configured');
      return new Response(JSON.stringify({
        error: 'Email configuration incomplete'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const emailData = {
      personalizations: [
        {
          to: recipientEmails.map((email) => ({
            email
          }))
        }
      ],
      from: {
        email: FROM_EMAIL,
        name: 'Sistema Calidad DC Concretos'
      },
      subject: subject,
      content: [
        {
          type: 'text/html',
          value: bodyHtml
        }
      ]
    };

    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!sgResponse.ok) {
      console.error('Error sending email via SendGrid:', sgResponse.status, await sgResponse.text());
      return new Response(JSON.stringify({
        error: `Email delivery failed (${sgResponse.status})`
      }), {
        status: sgResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`Precision notification sent for sample ${muestra.id} to plant ${plantId}: ${recipientEmails.join(', ')}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Precision notification sent successfully.',
      recipients: recipientEmails.length,
      plant_id: plantId,
      test_time_local: testTimeLocal,
      minutes_until_test: minutesUntilTest,
      recipients_list: recipientEmails
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error in enhanced notification function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
