import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromBody,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for updating role
const updateRoleSchema = z.object({
  role: z.enum(['executive', 'user'], {
    required_error: 'Role must be either executive or user',
  }),
  client_id: z.string().uuid().optional(),
});

/**
 * PATCH /api/client-portal/team/[userId]
 * Updates a team member's role
 * Only accessible by executive users
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetUserId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { role, client_id: bodyClientId } = validation.data;

    const clientIdParam =
      (bodyClientId && bodyClientId.trim()) ||
      getOptionalPortalClientIdFromBody(body) ||
      getOptionalPortalClientIdFromRequest(request);

    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    if (resolved.ctx.roleWithinClient !== 'executive') {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can update team member roles.' },
        { status: 403 }
      );
    }

    const clientId = resolved.ctx.clientId;

    // Prevent users from demoting themselves if they're the only executive
    if (targetUserId === user.id && role === 'user') {
      // Check if there are other executives
      const { data: executives, error: execError } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('client_id', clientId)
        .eq('role_within_client', 'executive')
        .eq('is_active', true);

      if (execError) {
        console.error('Error checking executives:', execError);
        return NextResponse.json(
          { error: 'Failed to verify executive count' },
          { status: 500 }
        );
      }

      if (executives && executives.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the only executive. Promote another user to executive first.' },
          { status: 400 }
        );
      }
    }

    // Get the target user's association
    const { data: targetAssociation, error: targetError } = await supabase
      .from('client_portal_users')
      .select('id, role_within_client')
      .eq('user_id', targetUserId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (targetError || !targetAssociation) {
      return NextResponse.json(
        { error: 'Team member not found or not active' },
        { status: 404 }
      );
    }

    // Don't update if role is the same
    if (targetAssociation.role_within_client === role) {
      return NextResponse.json(
        { error: 'User already has this role' },
        { status: 400 }
      );
    }

    // Update the role
    const { error: updateError } = await supabase
      .from('client_portal_users')
      .update({
        role_within_client: role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetAssociation.id);

    if (updateError) {
      console.error('Error updating role:', updateError);
      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      );
    }

    // Get updated team member data
    const { data: updatedMember, error: fetchError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        user_id,
        role_within_client,
        permissions,
        is_active,
        user_profiles!client_portal_users_user_id_fkey (
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', targetAssociation.id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated member:', fetchError);
    }

    return NextResponse.json({
      success: true,
      data: updatedMember,
      message: `User role updated to ${role} successfully`,
    });
  } catch (error) {
    console.error('Team member PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client-portal/team/[userId]
 * Deactivates a team member (soft delete)
 * Only accessible by executive users
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetUserId } = await params;

    // Prevent users from deactivating themselves
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    if (resolved.ctx.roleWithinClient !== 'executive') {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can deactivate team members.' },
        { status: 403 }
      );
    }

    const clientId = resolved.ctx.clientId;

    // Get the target user's association
    const { data: targetAssociation, error: targetError } = await supabase
      .from('client_portal_users')
      .select('id, role_within_client')
      .eq('user_id', targetUserId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (targetError || !targetAssociation) {
      return NextResponse.json(
        { error: 'Team member not found or already deactivated' },
        { status: 404 }
      );
    }

    // If deactivating an executive, ensure there's at least one other executive
    if (targetAssociation.role_within_client === 'executive') {
      const { data: executives, error: execError } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('client_id', clientId)
        .eq('role_within_client', 'executive')
        .eq('is_active', true);

      if (execError) {
        console.error('Error checking executives:', execError);
        return NextResponse.json(
          { error: 'Failed to verify executive count' },
          { status: 500 }
        );
      }

      if (executives && executives.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the only executive. Promote another user to executive first.' },
          { status: 400 }
        );
      }
    }

    // Soft delete: Set is_active to false
    const { error: deactivateError } = await supabase
      .from('client_portal_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetAssociation.id);

    if (deactivateError) {
      console.error('Error deactivating user:', deactivateError);
      return NextResponse.json(
        { error: 'Failed to deactivate user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Team member deactivated successfully',
    });
  } catch (error) {
    console.error('Team member DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
