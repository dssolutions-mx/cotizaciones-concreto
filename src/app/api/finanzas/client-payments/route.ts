import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
] as const;

function normalizePaymentDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  // Standardize to a safe timestamp to avoid timezone day-shift issues in daily reports.
  // We store payments at noon UTC for the selected date.
  if (value.includes('T')) {
    const datePart = value.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return new Date(`${datePart}T12:00:00.000Z`).toISOString();
    }
    return null;
  }

  // If it's YYYY-MM-DD, normalize to noon UTC to avoid timezone day-shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`).toISOString();
  }

  // Fallback: attempt Date parse
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return null;
  // Extract UTC date part and re-normalize to noon UTC
  const ymd = dt.toISOString().slice(0, 10);
  return new Date(`${ymd}T12:00:00.000Z`).toISOString();
}

async function requireAllowedRole(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role as any)) {
    return { ok: false as const };
  }

  return { ok: true as const, role };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');
    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('client_payments')
      .select('id, client_id, amount, payment_date, payment_method, reference_number, notes, construction_site, created_by, created_at')
      .eq('client_id', client_id)
      .order('payment_date', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }

    return NextResponse.json({ payments: data || [] });
  } catch (err) {
    console.error('GET /api/finanzas/client-payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      client_id,
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
      construction_site,
    } = body || {};

    if (!client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    if (typeof amount !== 'number' || !(amount > 0)) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    const normalizedDate = normalizePaymentDate(payment_date);
    if (!normalizedDate) return NextResponse.json({ error: 'payment_date is invalid or missing' }, { status: 400 });
    if (!payment_method || typeof payment_method !== 'string') {
      return NextResponse.json({ error: 'payment_method is required' }, { status: 400 });
    }

    const normalizedSite = construction_site === 'general' ? null : (construction_site ?? null);

    const { data: payment, error } = await supabase
      .from('client_payments')
      .insert({
        client_id,
        amount,
        payment_date: normalizedDate,
        payment_method,
        reference_number: reference_number || null,
        notes: notes || null,
        construction_site: normalizedSite,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({ payment });
  } catch (err) {
    console.error('POST /api/finanzas/client-payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

