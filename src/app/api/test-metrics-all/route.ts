import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await authClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const today = format(now, 'yyyy-MM-dd');
    
    // Test all the tables to see what data exists
    const [
      quotesTest,
      ordersTest,
      remisionesTest,
      clientsTest,
      recipesTest,
      ensayosTest
    ] = await Promise.all([
      supabase.from('quotes').select('*').limit(5),
      supabase.from('orders').select('*').limit(5),
      supabase.from('remisiones').select('*').limit(5),
      supabase.from('clients').select('*').limit(5),
      supabase.from('recipes').select('*').limit(5),
      supabase.from('ensayos').select('*').limit(5)
    ]);

    const testResults = {
      quotes: {
        count: quotesTest.data?.length || 0,
        sample: quotesTest.data?.[0] || null,
        error: quotesTest.error?.message || null
      },
      orders: {
        count: ordersTest.data?.length || 0,
        sample: ordersTest.data?.[0] || null,
        error: ordersTest.error?.message || null
      },
      remisiones: {
        count: remisionesTest.data?.length || 0,
        sample: remisionesTest.data?.[0] || null,
        error: remisionesTest.error?.message || null
      },
      clients: {
        count: clientsTest.data?.length || 0,
        sample: clientsTest.data?.[0] || null,
        error: clientsTest.error?.message || null
      },
      recipes: {
        count: recipesTest.data?.length || 0,
        sample: recipesTest.data?.[0] || null,
        error: recipesTest.error?.message || null
      },
      ensayos: {
        count: ensayosTest.data?.length || 0,
        sample: ensayosTest.data?.[0] || null,
        error: ensayosTest.error?.message || null
      }
    };

    return NextResponse.json(testResults);

  } catch (error) {
    console.error('Error in test metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 