import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GetActivitiesQuerySchema } from '@/lib/validations/inventory';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const queryParams = {
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      material_id: searchParams.get('material_id') || undefined,
      activity_type: (searchParams.get('activity_type') as 'ENTRY' | 'ADJUSTMENT' | 'all') || 'all',
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
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

    // Validate query parameters first
    const validatedQuery = GetActivitiesQuerySchema.parse(queryParams);

    // For users without plant_id (like EXECUTIVE), return empty data
    if (!profile.plant_id) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          limit: validatedQuery.limit,
          offset: validatedQuery.offset,
          hasMore: false,
        },
      });
    }

    // Get daily activity from the view
    const { data: activities, error: activitiesError } = await supabase
      .from('vw_daily_inventory_activity')
      .select('*')
      .eq('plant_id', profile.plant_id); // Fixed: should be plant_id, not plant_name

    if (activitiesError) {
      throw new Error(`Error al obtener actividad diaria: ${activitiesError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: activities,
      pagination: {
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        hasMore: activities.length === validatedQuery.limit,
      },
    });

  } catch (error) {
    console.error('Error in activity GET:', error);
    
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
