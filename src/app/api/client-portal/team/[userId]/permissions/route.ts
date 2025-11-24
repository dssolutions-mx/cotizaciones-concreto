import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for permissions
const updatePermissionsSchema = z.object({
  permissions: z.record(z.boolean(), {
    required_error: 'Permissions object is required',
  }),
});

/**
 * PATCH /api/client-portal/team/[userId]/permissions
 * Updates a team member's permissions
 * Only accessible by executive users
 * Note: Executive users always have full permissions regardless of this setting
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
    const validation = updatePermissionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { permissions } = validation.data;

    // Check if current user is an executive
    const { data: currentUserAssociation, error: currentUserError } = await supabase
      .from('client_portal_users')
      .select('client_id, role_within_client')
      .eq('user_id', user.id)
      .eq('role_within_client', 'executive')
      .eq('is_active', true)
      .single();

    if (currentUserError || !currentUserAssociation) {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can update permissions.' },
        { status: 403 }
      );
    }

    const clientId = currentUserAssociation.client_id;

    // Get the target user's association
    const { data: targetAssociation, error: targetError } = await supabase
      .from('client_portal_users')
      .select('id, role_within_client, permissions')
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

    // Note: Executives always have full permissions, but we allow updating the field
    // The frontend should show it as read-only/informational for executives
    if (targetAssociation.role_within_client === 'executive') {
      return NextResponse.json(
        {
          error: 'Executive users automatically have all permissions. Change to user role first if you want to restrict access.',
          info: 'Executives have full access regardless of permission settings.'
        },
        { status: 400 }
      );
    }

    // Update permissions
    const { error: updateError } = await supabase
      .from('client_portal_users')
      .update({
        permissions: permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetAssociation.id);

    if (updateError) {
      console.error('Error updating permissions:', updateError);
      return NextResponse.json(
        { error: 'Failed to update permissions' },
        { status: 500 }
      );
    }

    // Get updated data
    const { data: updatedMember, error: fetchError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        user_id,
        role_within_client,
        permissions,
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
      data: {
        permissions: updatedMember?.permissions || permissions,
      },
      message: 'Permissions updated successfully',
    });
  } catch (error) {
    console.error('Permissions PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
