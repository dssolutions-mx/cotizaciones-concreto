// Edge Function for sending notifications about pending test samples
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Define la estructura esperada del payload mejorado
interface AlertaPayload {
  muestra_id: string;
  fecha_alerta: string; // Fecha como string YYYY-MM-DD
  fecha_alerta_ts?: string; // Timestamp cuando enviar la alerta (24h antes)
  fecha_programada_ensayo_ts?: string; // Timestamp cuando debe hacerse el ensayo
  plant_id?: string; // ID de la planta para targeting específico
  timezone?: string; // Zona horaria del usuario/operación
  estado?: string; // Estado de la alerta
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for valid request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request data
    const alertaData = (await req.json()) as AlertaPayload;

    // Validate payload
    if (!alertaData.muestra_id || !alertaData.fecha_alerta) {
      return new Response(
        JSON.stringify({ error: 'Faltan muestra_id o fecha_alerta en el payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // DEBUG: Log the received payload
    console.log('🔍 ensayo-notification received payload:', {
      muestra_id: alertaData.muestra_id,
      fecha_alerta: alertaData.fecha_alerta,
      fecha_alerta_ts: alertaData.fecha_alerta_ts,
      fecha_programada_ensayo_ts: alertaData.fecha_programada_ensayo_ts,
      timezone: alertaData.timezone,
      plant_id: alertaData.plant_id,
      estado: alertaData.estado
    });

    // Get the user's timezone from the payload or default to Mexico City
    const userTimezone = alertaData.timezone || 'America/Mexico_City';

        // Calculate the exact UTC time for sending the notification
    // Priority: fecha_programada_ensayo_ts > fecha_alerta_ts > fallback
    let fechaEnvioUTC: string;

    if (alertaData.fecha_programada_ensayo_ts) {
      // BEST: Use the actual test time and send notification 5 minutes before
      const testTime = new Date(alertaData.fecha_programada_ensayo_ts);
      const sendTime = new Date(testTime.getTime() - (5 * 60 * 1000)); // 5 minutes before test
      fechaEnvioUTC = sendTime.toISOString();
      console.log('🔍 Using test time (5 min before):', {
        testTime: testTime.toISOString(),
        sendTime: sendTime.toISOString(),
        userTimezone
      });
    } else if (alertaData.fecha_alerta_ts) {
      // GOOD: Use the alert timestamp directly (already 24h before test)
      const alertTime = new Date(alertaData.fecha_alerta_ts);
      fechaEnvioUTC = alertTime.toISOString();
      console.log('🔍 Using alert timestamp directly:', {
        alertTime: alertTime.toISOString(),
        userTimezone
      });
    } else {
      // FALLBACK: parse the date and assume 9:00 AM local time
      console.log('🔍 Using fallback - both timestamps missing');
      const alertDate = new Date(alertaData.fecha_alerta);
      const localTime = new Date(alertDate);
      localTime.setHours(9, 0, 0, 0);

      fechaEnvioUTC = localTime.toISOString();
      console.log('🔍 Fallback calculation:', {
        alertDate: alertDate.toISOString(),
        localTime: localTime.toISOString(),
        fechaEnvioUTC
      });
    }

    // Calculate the actual send date (not the alert date)
    const sendDateTime = new Date(fechaEnvioUTC);
    const sendDate = sendDateTime.toISOString().split('T')[0]; // Extract YYYY-MM-DD

    console.log('🔍 Date correction:', {
      alertDate: alertaData.fecha_alerta,
      sendDate: sendDate,
      sendDateTime: sendDateTime.toISOString(),
      corrected: alertaData.fecha_alerta !== sendDate
    });

    // Insertar en la cola de notificaciones con información mejorada
    const { error: insertError } = await supabaseAdmin
      .from('quality_notification_queue')
      .insert({
        muestra_id: alertaData.muestra_id,
        fecha_programada_envio: sendDate, // Use actual send date, not alert date
        fecha_envio_timestamp_utc: fechaEnvioUTC,
        plant_id: alertaData.plant_id || null,
        timezone_local: userTimezone,
        tipo_notificacion: 'REMINDER_5MIN',
        estado: 'PENDIENTE',
        intentos: 0,
      });

    if (insertError) {
      console.error('Error insertando en quality_notification_queue:', insertError);
      const errorMessage = insertError.message || 'Error interno al insertar en la cola.';
      return new Response(JSON.stringify({ error: `Error al programar notificación: ${errorMessage}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return success response
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Notificación programada correctamente en la cola',
      details: {
        muestra_id: alertaData.muestra_id,
        fecha_alerta: alertaData.fecha_alerta,
        timezone: userTimezone,
        fecha_envio_utc: fechaEnvioUTC
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // Log error details and return error response
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error en ensayo-notification function:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'An unknown error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
