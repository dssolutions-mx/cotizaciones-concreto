import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { replaceClientPortalMembershipPlantIds } from '@/lib/supabase/portalMembershipPlants';
import { replaceClientPortalMembershipSiteIds } from '@/lib/supabase/portalMembershipSites';

export const dynamic = 'force-dynamic';

const assignClientSchema = z.object({
  clientId: z.string().uuid('ID de cliente inválido'),
  role: z.enum(['executive', 'user'], {
    required_error: 'El rol debe ser executive o user',
  }),
  permissions: z.record(z.boolean()).optional(),
  constructionSiteIds: z.array(z.string().uuid()).optional(),
  /** Non-empty = restrict to these plants; omit or empty = all plants */
  plantIds: z.array(z.string().uuid()).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['executive', 'user']),
  permissions: z.record(z.boolean()).optional(),
  constructionSiteIds: z.array(z.string().uuid()).optional(),
  plantIds: z.array(z.string().uuid()).optional(),
});

async function validateActivePlantIds(
  supabase: ReturnType<typeof createServerSupabaseClientFromRequest>,
  plantIds: string[] | undefined
): Promise<NextResponse | null> {
  if (!plantIds?.length) return null;
  const { count, error } = await supabase
    .from('plants')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .in('id', plantIds);
  if (error) {
    return NextResponse.json({ error: 'Error validando plantas' }, { status: 500 });
  }
  if ((count ?? 0) !== plantIds.length) {
    return NextResponse.json(
      { error: 'Una o más plantas no son válidas o están inactivas' },
      { status: 400 }
    );
  }
  return null;
}

/**
 * POST /api/admin/client-portal-users/[userId]/clients
 * Assign a client to a portal user
 */
export async function POST(
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

    let db;
    try {
      db = createServiceClient();
    } catch {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = assignClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validación fallida',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { clientId, role, permissions, constructionSiteIds, plantIds } = validation.data;

    const plantErr = await validateActivePlantIds(supabase, plantIds);
    if (plantErr) return plantErr;

    if (constructionSiteIds?.length) {
      const { count, error: cntErr } = await supabase
        .from('construction_sites')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('id', constructionSiteIds);
      if (cntErr) {
        return NextResponse.json({ error: 'Error validando obras' }, { status: 500 });
      }
      if ((count ?? 0) !== constructionSiteIds.length) {
        return NextResponse.json({ error: 'Una o más obras no pertenecen a este cliente' }, { status: 400 });
      }
    }

    // Verify user exists and is EXTERNAL_CLIENT
    const { data: portalUser } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', userId)
      .eq('role', 'EXTERNAL_CLIENT')
      .single();

    if (!portalUser) {
      return NextResponse.json(
        { error: 'Usuario del portal no encontrado' },
        { status: 404 }
      );
    }

    // Check if association already exists
    const { data: existing } = await db
      .from('client_portal_users')
      .select('id')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'El usuario ya está asociado con este cliente' },
        { status: 400 }
      );
    }

    // Get default permissions if user role and no permissions provided
    let finalPermissions: Record<string, boolean> = permissions ?? {};
    if (role === 'user' && Object.keys(finalPermissions).length === 0) {
      const { data: client } = await supabase
        .from('clients')
        .select('default_permissions')
        .eq('id', clientId)
        .single();

      const dp = client?.default_permissions;
      if (dp && typeof dp === 'object' && !Array.isArray(dp)) {
        finalPermissions = Object.fromEntries(
          Object.entries(dp as Record<string, unknown>).filter(
            (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
          )
        );
      }
    }

    // Create association
    const { data: insertedAssoc, error: insertError } = await db
      .from('client_portal_users')
      .insert({
        user_id: userId,
        client_id: clientId,
        role_within_client: role,
        permissions: finalPermissions,
        is_active: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !insertedAssoc?.id) {
      console.error('Error creating association:', insertError);
      return NextResponse.json(
        { error: 'Error al crear asociación' },
        { status: 500 }
      );
    }

    const { error: siteErr } = await replaceClientPortalMembershipSiteIds(
      db,
      insertedAssoc.id,
      constructionSiteIds
    );
    if (siteErr) {
      console.error('Error assigning obra scope:', siteErr);
      return NextResponse.json({ error: 'Asociación creada pero falló asignación de obras' }, { status: 500 });
    }

    const { error: plantScopeErr } = await replaceClientPortalMembershipPlantIds(
      db,
      insertedAssoc.id,
      plantIds
    );
    if (plantScopeErr) {
      console.error('Error assigning plant scope:', plantScopeErr);
      return NextResponse.json({ error: 'Asociación creada pero falló asignación de plantas' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente asignado exitosamente',
    });
  } catch (error) {
    console.error('Admin assign client API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/client-portal-users/[userId]/clients?clientId=xxx
 * Remove client association from user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId es requerido' },
        { status: 400 }
      );
    }

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

    let db;
    try {
      db = createServiceClient();
    } catch {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }

    // Delete association
    const { error: deleteError } = await db
      .from('client_portal_users')
      .delete()
      .eq('user_id', userId)
      .eq('client_id', clientId);

    if (deleteError) {
      console.error('Error deleting association:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar asociación' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Asociación eliminada exitosamente',
    });
  } catch (error) {
    console.error('Admin remove client API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/client-portal-users/[userId]/clients?clientId=xxx
 * Update user role within a specific client
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId es requerido' },
        { status: 400 }
      );
    }

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

    let db;
    try {
      db = createServiceClient();
    } catch {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validación fallida',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { role, permissions, constructionSiteIds, plantIds } = validation.data;

    const plantValErr = await validateActivePlantIds(supabase, plantIds);
    if (plantValErr) return plantValErr;

    if (constructionSiteIds?.length) {
      const { count, error: cntErr } = await supabase
        .from('construction_sites')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('id', constructionSiteIds);
      if (cntErr) {
        return NextResponse.json({ error: 'Error validando obras' }, { status: 500 });
      }
      if ((count ?? 0) !== constructionSiteIds.length) {
        return NextResponse.json({ error: 'Una o más obras no pertenecen a este cliente' }, { status: 400 });
      }
    }

    // Update association
    const updateData: any = {
      role_within_client: role,
    };

    if (role === 'user' && permissions) {
      updateData.permissions = permissions;
    } else if (role === 'executive') {
      updateData.permissions = {};
    }

    const { error: updateError } = await db
      .from('client_portal_users')
      .update(updateData)
      .eq('user_id', userId)
      .eq('client_id', clientId);

    if (updateError) {
      console.error('Error updating association:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar asociación' },
        { status: 500 }
      );
    }

    if (constructionSiteIds !== undefined) {
      const { data: row } = await db
        .from('client_portal_users')
        .select('id')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .maybeSingle();
      if (row?.id) {
        const { error: siteErr } = await replaceClientPortalMembershipSiteIds(
          db,
          row.id,
          constructionSiteIds
        );
        if (siteErr) {
          console.error('Error updating obra scope:', siteErr);
          return NextResponse.json({ error: 'Rol actualizado pero falló asignación de obras' }, { status: 500 });
        }
      }
    }

    if (plantIds !== undefined) {
      const { data: row } = await db
        .from('client_portal_users')
        .select('id')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .maybeSingle();
      if (row?.id) {
        const { error: plantErr } = await replaceClientPortalMembershipPlantIds(db, row.id, plantIds);
        if (plantErr) {
          console.error('Error updating plant scope:', plantErr);
          return NextResponse.json({ error: 'Rol actualizado pero falló asignación de plantas' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Rol actualizado exitosamente',
    });
  } catch (error) {
    console.error('Admin update role API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

