import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * Thin proxy: pg_cron calls this; it forwards to the Next.js API (single source of truth).
 * Set secrets: APP_URL (or NEXT_PUBLIC_APP_URL), COMPLIANCE_CRON_SECRET
 */
serve(async (req) => {
  try {
    const secret = Deno.env.get('COMPLIANCE_CRON_SECRET');
    const incoming = req.headers.get('x-compliance-secret');
    if (!secret || incoming !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ??
      '').replace(/\/$/, '');
    if (!appUrl) {
      return new Response(
        JSON.stringify({
          error: 'missing_env',
          detail: 'Set APP_URL or NEXT_PUBLIC_APP_URL on this function',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const url = new URL(req.url);
    const notify = url.searchParams.get('notify') ?? '1';
    const res = await fetch(
      `${appUrl}/api/compliance/daily/run?date=auto&notify=${notify}`,
      {
        method: 'GET',
        headers: {
          'x-compliance-secret': secret,
        },
      },
    );
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
