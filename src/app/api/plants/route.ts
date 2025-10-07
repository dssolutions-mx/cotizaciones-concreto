import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeParam = searchParams.get('active');

    // Build query for plants
    let query = supabase
      .from('plants')
      .select('*')
      .order('name');

    // Filter by active status - default to true if not specified
    if (activeParam !== 'false') {
      query = query.eq('is_active', true);
    }

    // Fetch plants
    const { data: plants, error } = await query;

    if (error) {
      console.error('Error fetching plants:', error);
      return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plants });
  } catch (error) {
    console.error('Error in plants API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

