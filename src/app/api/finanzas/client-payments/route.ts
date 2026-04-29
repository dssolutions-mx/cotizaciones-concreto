import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeFifoAllocation } from '@/lib/finanzas/paymentConstructionSite';
import { fetchFifoSiteDebts } from '@/lib/finanzas/fifoSiteDebts';

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

async function recalcBalancesForSites(
  supabase: any,
  clientId: string,
  siteNames: Set<string | null | undefined>
) {
  const uniqueSites = [...siteNames].filter((s): s is string => typeof s === 'string' && s.length > 0);
  for (const site of uniqueSites) {
    await supabase.rpc('update_client_balance', {
      p_client_id: clientId,
      p_site_name: site,
    });
  }
  await supabase.rpc('update_client_balance', {
    p_client_id: clientId,
    p_site_name: null,
  });
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
      verification_call_confirmed,
    } = body || {};

    if (!client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    if (typeof amount !== 'number' || !(amount > 0)) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    const normalizedDate = normalizePaymentDate(payment_date);
    if (!normalizedDate) return NextResponse.json({ error: 'payment_date is invalid or missing' }, { status: 400 });
    if (!payment_method || typeof payment_method !== 'string') {
      return NextResponse.json({ error: 'payment_method is required' }, { status: 400 });
    }

    const isCashPayment = payment_method === 'CASH' || payment_method === 'Efectivo';
    if (isCashPayment && verification_call_confirmed !== true) {
      return NextResponse.json(
        { error: 'Para pagos en efectivo debe confirmar el cumplimiento del procedimiento de verificación (Política 3.4)' },
        { status: 400 }
      );
    }

    const wantsGeneral =
      construction_site == null ||
      construction_site === '' ||
      (typeof construction_site === 'string' && construction_site.trim().toLowerCase() === 'general');

    const explicitSiteName = wantsGeneral
      ? null
      : typeof construction_site === 'string'
        ? construction_site.trim()
        : null;

    const insertPayload: Record<string, unknown> = {
      client_id,
      amount,
      payment_date: normalizedDate,
      payment_method,
      reference_number: reference_number || null,
      notes: notes || null,
      construction_site: explicitSiteName,
      created_by: user.id,
    };
    if (isCashPayment) {
      insertPayload.verification_call_confirmed = verification_call_confirmed === true;
    }

    const { data: payment, error } = await supabase
      .from('client_payments')
      .insert(insertPayload as never)
      .select()
      .single();

    if (error) {
      console.error('Failed to create payment:', error);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    const sitesToRecalc = new Set<string | null | undefined>();

    if (explicitSiteName) {
      const { error: distError } = await supabase.from('client_payment_distributions').insert({
        payment_id: payment.id,
        construction_site: explicitSiteName,
        amount,
      });

      if (distError) {
        console.error('Failed to create payment distribution:', distError);
      }
      sitesToRecalc.add(explicitSiteName);
    } else {
      const debts = await fetchFifoSiteDebts(supabase, client_id);

      if (debts.length === 0) {
        const { error: distError } = await supabase.from('client_payment_distributions').insert({
          payment_id: payment.id,
          construction_site: null,
          amount,
        });
        if (distError) {
          console.error('Failed to create payment distribution (general credit):', distError);
        }
      } else {
        const { distributions, surplusToGeneral } = computeFifoAllocation(debts, amount);

        const rows: { payment_id: string; construction_site: string | null; amount: number }[] =
          distributions.map((d) => ({
            payment_id: payment.id,
            construction_site: d.construction_site,
            amount: d.amount,
          }));

        if (surplusToGeneral > 0) {
          rows.push({
            payment_id: payment.id,
            construction_site: null,
            amount: surplusToGeneral,
          });
        }

        if (rows.length === 0) {
          const { error: distError } = await supabase.from('client_payment_distributions').insert({
            payment_id: payment.id,
            construction_site: null,
            amount,
          });
          if (distError) {
            console.error('Failed to create fallback payment distribution:', distError);
          }
        } else {
          const { error: distError } = await supabase.from('client_payment_distributions').insert(rows);
          if (distError) {
            console.error('Failed to create payment distributions:', distError);
          }
        }

        for (const d of distributions) sitesToRecalc.add(d.construction_site);
        if (surplusToGeneral > 0) sitesToRecalc.add(null);
      }
    }

    try {
      await recalcBalancesForSites(supabase, client_id, sitesToRecalc);
    } catch (balanceErr) {
      console.error('Balance update error:', balanceErr);
    }

    return NextResponse.json({ payment });
  } catch (err) {
    console.error('POST /api/finanzas/client-payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
