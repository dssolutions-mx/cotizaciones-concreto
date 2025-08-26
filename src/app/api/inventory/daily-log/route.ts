import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  GetDailyLogQuerySchema,
  DailyLogInputSchema,
  CloseDailyLogSchema 
} from '@/lib/validations/inventory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const queryParams = {
      date: searchParams.get('date'),
      plant_id: searchParams.get('plant_id') || undefined,
    };

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    // For users without plant_id (like EXECUTIVE), return empty data
    if (!profile.plant_id) {
      return NextResponse.json({
        success: true,
        data: {
          id: null,
          plant_id: null,
          log_date: validatedQuery.date,
          total_entries: 0,
          total_adjustments: 0,
          total_consumption: 0,
          is_closed: false,
          daily_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }

    // Validate query parameters
    const validatedQuery = GetDailyLogQuerySchema.parse(queryParams);

    // Get daily log
    const { data: dailyLog, error: dailyLogError } = await supabase
      .from('daily_inventory_log')
      .select('*')
      .eq('plant_id', profile.plant_id)
      .eq('log_date', validatedQuery.date)
      .single();

    if (dailyLogError && dailyLogError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Error al obtener bitácora diaria: ${dailyLogError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: dailyLog,
    });

  } catch (error) {
    console.error('Error in daily-log GET:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Parámetros de consulta inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    // For users without plant_id (like EXECUTIVE), return success but no data
    if (!profile.plant_id) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Usuario sin planta asignada - no se puede crear bitácora diaria',
      });
    }

    const body = await request.json();

    // Validate daily log input data
    const validatedData = DailyLogInputSchema.parse(body);

    // Check if daily log already exists
    const { data: existingLog, error: checkError } = await supabase
      .from('daily_inventory_log')
      .select('*')
      .eq('plant_id', profile.plant_id)
      .eq('log_date', validatedData.log_date)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Error al verificar bitácora diaria: ${checkError.message}`);
    }

    if (existingLog) {
      return NextResponse.json({
        success: true,
        data: existingLog,
        message: 'Bitácora diaria ya existe para esta fecha',
      });
    }

    // If no log exists for this date, it will be created automatically when the first entry/adjustment is made
    return NextResponse.json({
      success: true,
      data: null,
      message: 'La bitácora diaria se creará automáticamente con la primera entrada del día',
    });

  } catch (error) {
    console.error('Error in daily-log POST:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Datos de entrada inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 });
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para gestionar inventario' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'close') {
      // Validate close daily log data
      const validatedData = CloseDailyLogSchema.parse(data);
      
      // Close daily log
      const { data: result, error: closeError } = await supabase
        .from('daily_inventory_log')
        .update({
          is_closed: true,
          closed_by: user.id,
          closed_at: new Date().toISOString(),
          daily_notes: data.daily_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('plant_id', profile.plant_id)
        .eq('log_date', validatedData.log_date)
        .select()
        .single();

      if (closeError) {
        throw new Error(`Error al cerrar bitácora diaria: ${closeError.message}`);
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Bitácora diaria cerrada exitosamente',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Use "close" para cerrar la bitácora' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in daily-log PUT:', error);
    
    if (error instanceof Error) {
      // Check for validation errors
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Datos de entrada inválidos', details: error.message },
          { status: 400 }
        );
      }
      
      // Check for authentication errors
      if (error.message.includes('autenticado') || error.message.includes('permisos')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // Check if daily log doesn't exist
      if (error.message.includes('not found') || error.message.includes('no encontrado')) {
        return NextResponse.json(
          { success: false, error: 'Bitácora diaria no encontrada para esta fecha' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
