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

    const normalizedSite = construction_site === 'general' ? null : (construction_site ?? null);

    // Resolve the distribution target up-front: per-site balances drift from the aggregate
    // unless every distribution row has a site. Reject ambiguous payments instead of silently
    // creating a NULL-site distribution.
    let distributionSite: string | null = normalizedSite;

    if (!distributionSite) {
      // Active sites = sites with billable orders (remisiones / effective_for_balance) or distributions
      const [{ data: orderSites }, { data: distSites }] = await Promise.all([
        supabase
          .from('orders')
          .select('construction_site, remisiones!inner(id), effective_for_balance')
          .eq('client_id', client_id)
          .not('construction_site', 'is', null)
          .not('order_status', 'eq', 'cancelled'),
        supabase
          .from('client_payment_distributions')
          .select('construction_site, payment:client_payments!inner(client_id)')
          .eq('payment.client_id', client_id)
          .not('construction_site', 'is', null),
      ]);

      const activeSites = new Set<string>();
      for (const o of orderSites || []) {
        const site = (o as { construction_site?: string | null }).construction_site;
        if (site) activeSites.add(site);
      }
      for (const d of distSites || []) {
        const site = (d as { construction_site?: string | null }).construction_site;
        if (site) activeSites.add(site);
      }

      if (activeSites.size === 1) {
        distributionSite = [...activeSites][0];
      } else if (activeSites.size === 0) {
        // No active site context yet; allow only if client has zero sites on any order at all.
        const { data: anySites } = await supabase
          .from('orders')
          .select('construction_site')
          .eq('client_id', client_id)
          .not('construction_site', 'is', null)
          .limit(1);
        if ((anySites || []).length === 0) {
          // Truly site-less client: keep NULL (no per-site row will exist; invariant trivially holds)
          distributionSite = null;
        } else {
          return NextResponse.json(
            {
              error:
                'construction_site is required for this client (multiple sites exist). Specify which site this payment applies to.',
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error:
              'construction_site is required for this client (multiple sites exist). Specify which site this payment applies to.',
          },
          { status: 400 }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      client_id,
      amount,
      payment_date: normalizedDate,
      payment_method,
      reference_number: reference_number || null,
      notes: notes || null,
      construction_site: normalizedSite,
      created_by: user.id,
    };
    if (isCashPayment) {
      insertPayload.verification_call_confirmed = verification_call_confirmed === true;
    }

    const { data: payment, error } = await supabase
      .from('client_payments')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Failed to create payment:', error);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    const { error: distError } = await supabase
      .from('client_payment_distributions')
      .insert({
        payment_id: payment.id,
        construction_site: distributionSite,
        amount: amount,
      });

    if (distError) {
      console.error('Failed to create payment distribution:', distError);
      // Payment was created but distribution failed - log but don't fail the request
      // The payment exists, just the distribution is missing
    }

    // Trigger balance recalculation
    try {
      // Update balance for the specific site if applicable
      if (distributionSite) {
        await supabase.rpc('update_client_balance', { 
          p_client_id: client_id, 
          p_site_name: distributionSite 
        });
      }
      // Always update the general balance
      await supabase.rpc('update_client_balance', { 
        p_client_id: client_id, 
        p_site_name: null 
      });
    } catch (balanceErr) {
      console.error('Balance update error:', balanceErr);
      // Don't fail the request - payment was created successfully
    }

    return NextResponse.json({ payment });
  } catch (err) {
    console.error('POST /api/finanzas/client-payments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

