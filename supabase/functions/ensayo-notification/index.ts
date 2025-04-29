// Edge Function for sending notifications about pending test samples
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Define la estructura esperada del payload
interface AlertaPayload {
  muestra_id: string;
  fecha_alerta: string; // Esperamos la fecha como string YYYY-MM-DD
  estado?: string; // Opcional, no lo usaremos directamente aquí
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
    // Nota: Usamos service_role ya que esta función es llamada por un trigger de BD
    // y necesita permisos para insertar en la tabla de cola.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Insertar en la cola de notificaciones
    const { error: insertError } = await supabaseAdmin
      .from('quality_notification_queue')
      .insert({
        muestra_id: alertaData.muestra_id,
        fecha_programada_envio: alertaData.fecha_alerta, // Usamos la fecha_alerta como fecha de envío
        estado: 'PENDIENTE', // Estado inicial
        intentos: 0,
      });

    if (insertError) {
      console.error('Error insertando en quality_notification_queue:', insertError);
      // Intenta devolver un mensaje de error más específico si es posible
      const errorMessage = insertError.message || 'Error interno al insertar en la cola.';
      return new Response(JSON.stringify({ error: `Error al programar notificación: ${errorMessage}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return success response
    return new Response(JSON.stringify({ success: true, message: 'Notificación programada correctamente en la cola' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // Log error details and return error response
    const error = e instanceof Error ? e : new Error(String(e)); // Asegura que sea un objeto Error
    console.error('Error en ensayo-notification function:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'An unknown error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
