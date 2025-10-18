import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'ADMINISTRATIVE'];
    if (!profile || !allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const payable_id = searchParams.get('payable_id');
    if (!payable_id) return NextResponse.json({ error: 'payable_id is required' }, { status: 400 });

    let query = supabase.from('payments').select('*').eq('payable_id', payable_id);

    const { data, error } = await query.order('payment_date', { ascending: false });
    if (error) return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });

    return NextResponse.json({ payments: data || [] });
  } catch (err) {
    console.error('GET /api/ap/payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'ADMINISTRATIVE'];
    if (!profile || !allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { payable_id, payment_date, amount, method, reference } = body || {};
    if (!payable_id || !payment_date || !amount) {
      return NextResponse.json({ error: 'payable_id, payment_date, amount are required' }, { status: 400 });
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({ payable_id, payment_date, amount, method, reference, created_by: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });

    // Recalc totals via trigger (already set); fetch payable for convenience
    const { data: payable } = await supabase
      .from('payables')
      .select('*')
      .eq('id', payable_id)
      .single();

    return NextResponse.json({ payment, payable });
  } catch (err) {
    console.error('POST /api/ap/payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
