import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/me/role-and-permissions
 * Gets the current user's role and permissions within their client organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's client portal association(s)
    // For MVP, we'll use the first active association
    const { data: association, error: assocError } = await supabase
      .from('client_portal_users')
      .select('role_within_client, permissions, client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (assocError) {
      console.error('Error fetching user association:', assocError);
      return NextResponse.json(
        { error: 'Failed to fetch user role' },
        { status: 500 }
      );
    }

    if (!association) {
      // User is not associated with any client yet
      // This might happen for newly created users
      return NextResponse.json({
        role_within_client: 'user',
        permissions: {
          create_orders: false,
          view_orders: true,
          view_prices: false,
          view_quality_data: false,
          bypass_executive_approval: false,
          manage_team: false,
          approve_orders: false,
        },
        client_id: null,
      });
    }

    return NextResponse.json({
      role_within_client: association.role_within_client,
      permissions: association.permissions,
      client_id: association.client_id,
    });
  } catch (error) {
    console.error('Role and permissions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
