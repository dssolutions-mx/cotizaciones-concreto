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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`).toISOString();
  }
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return null;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
      construction_site,
      reason,
    } = body || {};

    if (typeof amount !== 'number' || !(amount > 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    const normalizedDate = normalizePaymentDate(payment_date);
    if (!normalizedDate) return NextResponse.json({ error: 'payment_date is invalid or missing' }, { status: 400 });
    if (!payment_method || typeof payment_method !== 'string') {
      return NextResponse.json({ error: 'payment_method is required' }, { status: 400 });
    }

    const normalizedSite = construction_site === 'general' ? null : (construction_site ?? null);

    // Use RPC so the DB trigger can include optional `reason` in the audit log
    const { data, error } = await supabase.rpc('admin_update_client_payment', {
      p_payment_id: id,
      p_amount: amount,
      p_payment_date: normalizedDate,
      p_payment_method: payment_method,
      p_reference_number: reference_number ?? null,
      p_notes: notes ?? null,
      p_construction_site: normalizedSite,
      p_reason: typeof reason === 'string' ? reason : null,
    });

    if (error) {
      // Map common errors
      const msg = (error as any)?.message || 'Failed to update payment';
      const status = msg.toLowerCase().includes('forbidden') ? 403 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({ payment: data });
  } catch (err) {
    console.error('PATCH /api/finanzas/client-payments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason');

    const { error } = await supabase.rpc('admin_delete_client_payment', {
      p_payment_id: id,
      p_reason: reason || null,
    });

    if (error) {
      const msg = (error as any)?.message || 'Failed to delete payment';
      const status = msg.toLowerCase().includes('forbidden') ? 403 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/finanzas/client-payments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

