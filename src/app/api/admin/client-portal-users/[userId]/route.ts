import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * GET /api/admin/client-portal-users/[userId]
 * Get a single portal user with all client associations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { userId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS') {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Get user
    const { data: portalUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, role, is_active, created_at')
      .eq('id', userId)
      .eq('role', 'EXTERNAL_CLIENT')
      .single();

    if (userError || !portalUser) {
      return NextResponse.json(
        { error: 'Usuario del portal no encontrado' },
        { status: 404 }
      );
    }

    // Get client associations
    const { data: associations, error: assocError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        user_id,
        client_id,
        role_within_client,
        permissions,
        is_active,
        invited_at,
        clients!inner (
          id,
          business_name,
          client_code
        )
      `)
      .eq('user_id', userId);

    if (assocError) {
      console.error('Error fetching associations:', assocError);
      return NextResponse.json(
        { error: 'Error al obtener asociaciones' },
        { status: 500 }
      );
    }

    const clientAssociations = (associations || []).map((assoc: any) => {
      const client = assoc.clients;
      return {
        id: assoc.id,
        client_id: assoc.client_id,
        client_name: client.business_name,
        client_code: client.client_code,
        role_within_client: assoc.role_within_client,
        permissions: assoc.permissions || {},
        is_active: assoc.is_active,
        invited_at: assoc.invited_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...portalUser,
        client_associations: clientAssociations,
      },
    });
  } catch (error) {
    console.error('Admin portal user API GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/client-portal-users/[userId]
 * Update portal user profile
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { userId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS') {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validación fallida',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { firstName, lastName } = validation.data;

    // Update user profile
    const updateData: any = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .eq('role', 'EXTERNAL_CLIENT');

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
    });
  } catch (error) {
    console.error('Admin portal user API PATCH error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/client-portal-users/[userId]
 * Deactivate portal user (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { userId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS') {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Prevent self-deactivation
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes desactivarte a ti mismo' },
        { status: 400 }
      );
    }

    // Deactivate all client associations
    const { error: assocError } = await supabase
      .from('client_portal_users')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (assocError) {
      console.error('Error deactivating associations:', assocError);
      return NextResponse.json(
        { error: 'Error al desactivar asociaciones' },
        { status: 500 }
      );
    }

    // Deactivate user profile
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error deactivating user:', profileUpdateError);
      return NextResponse.json(
        { error: 'Error al desactivar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
    });
  } catch (error) {
    console.error('Admin portal user API DELETE error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

