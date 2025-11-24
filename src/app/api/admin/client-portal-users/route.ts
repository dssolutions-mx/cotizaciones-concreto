import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createPortalUserSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  clientIds: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos un cliente'),
  roles: z.record(z.enum(['executive', 'user'])),
  permissions: z.record(z.record(z.boolean())).optional(),
});

/**
 * GET /api/admin/client-portal-users
 * List all portal users with their client associations
 * Only accessible by EXECUTIVE or ADMIN_OPERATIONS
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

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
        { error: 'Acceso denegado. Solo administradores pueden acceder.' },
        { status: 403 }
      );
    }

    // Get all portal users
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, role, is_active, created_at')
      .eq('role', 'EXTERNAL_CLIENT')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching portal users:', usersError);
      return NextResponse.json(
        { error: 'Error al obtener usuarios del portal' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const userIds = users.map(u => u.id);

    // Get all client associations
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
      .in('user_id', userIds);

    if (assocError) {
      console.error('Error fetching client associations:', assocError);
      return NextResponse.json(
        { error: 'Error al obtener asociaciones de clientes' },
        { status: 500 }
      );
    }

    // Group associations by user
    const associationsByUser = new Map<string, any[]>();
    associations?.forEach((assoc: any) => {
      const client = assoc.clients;
      if (!associationsByUser.has(assoc.user_id)) {
        associationsByUser.set(assoc.user_id, []);
      }
      associationsByUser.get(assoc.user_id)!.push({
        id: assoc.id,
        client_id: assoc.client_id,
        client_name: client.business_name,
        client_code: client.client_code,
        role_within_client: assoc.role_within_client,
        permissions: assoc.permissions || {},
        is_active: assoc.is_active,
        invited_at: assoc.invited_at,
      });
    });

    // Combine users with associations
    const portalUsers = users.map(user => ({
      ...user,
      client_associations: associationsByUser.get(user.id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: portalUsers,
    });
  } catch (error) {
    console.error('Admin portal users API GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/client-portal-users
 * Create a new portal user and optionally assign to clients
 * Only accessible by EXECUTIVE or ADMIN_OPERATIONS
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

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
        { error: 'Acceso denegado. Solo administradores pueden crear usuarios.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createPortalUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validación fallida',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, firstName, lastName, clientIds, roles, permissions } = validation.data;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      // User exists, check if already EXTERNAL_CLIENT
      if (existingUser.email === email) {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', existingUser.id)
          .single();

        if (existingProfile?.role === 'EXTERNAL_CLIENT') {
          userId = existingUser.id;
        } else {
          return NextResponse.json(
            { error: 'El usuario existe pero no es un usuario del portal' },
            { status: 400 }
          );
        }
      } else {
        userId = existingUser.id;
      }
    } else {
      // Create new user via Supabase Admin API
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!serviceRoleKey || !supabaseUrl) {
        return NextResponse.json(
          { error: 'Error de configuración del servidor' },
          { status: 500 }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false, // User will confirm via invitation
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (authError || !authData.user) {
        console.error('Error creating auth user:', authError);
        return NextResponse.json(
          { error: 'Error al crear usuario de autenticación' },
          { status: 500 }
        );
      }

      userId = authData.user.id;

      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          role: 'EXTERNAL_CLIENT',
          is_portal_user: true,
          is_active: true,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        return NextResponse.json(
          { error: 'Error al crear perfil de usuario' },
          { status: 500 }
        );
      }
    }

    // Assign clients
    const clientAssociations = [];
    for (const clientId of clientIds) {
      const role = roles[clientId] || 'user';
      
      // Get default permissions if user role
      let finalPermissions = permissions?.[clientId] || {};
      if (role === 'user' && Object.keys(finalPermissions).length === 0) {
        const { data: client } = await supabase
          .from('clients')
          .select('default_permissions')
          .eq('id', clientId)
          .single();
        
        finalPermissions = client?.default_permissions || {};
      }

      // Check if association already exists
      const { data: existingAssoc } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .single();

      if (existingAssoc) {
        // Update existing association
        const { error: updateError } = await supabase
          .from('client_portal_users')
          .update({
            role_within_client: role,
            permissions: finalPermissions,
            is_active: true,
          })
          .eq('id', existingAssoc.id);

        if (updateError) {
          console.error(`Error updating association for client ${clientId}:`, updateError);
        } else {
          clientAssociations.push({ clientId, role });
        }
      } else {
        // Create new association
        const { error: insertError } = await supabase
          .from('client_portal_users')
          .insert({
            user_id: userId,
            client_id: clientId,
            role_within_client: role,
            permissions: finalPermissions,
            is_active: true,
            invited_by: user.id,
            invited_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error creating association for client ${clientId}:`, insertError);
        } else {
          clientAssociations.push({ clientId, role });
        }
      }
    }

    // TODO: Send invitation email

    return NextResponse.json({
      success: true,
      data: {
        userId,
        email,
        clientAssociations,
        message: 'Usuario del portal creado exitosamente',
      },
    });
  } catch (error) {
    console.error('Admin portal users API POST error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

