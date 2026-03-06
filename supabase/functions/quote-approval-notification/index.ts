import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://dcconcretos-hub.com';

const EXPIRES_IN = 604800; // 7 days

const RANGE_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
const DEFAULT_ZONE_SURCHARGE: Record<string, number> = { C: 200, D: 200, E: 200, F: 200, G: 200 };

function isZoneCOrHigher(code?: string | null): boolean {
  if (!code) return false;
  return (RANGE_ORDER[code] ?? 0) >= RANGE_ORDER.C;
}

function getZoneSurcharge(
  rangeCode: string | undefined,
  distanceRanges: Array<{ range_code?: string; diferencial?: number | null }>
): number {
  if (!rangeCode || !isZoneCOrHigher(rangeCode)) return 0;
  const row = distanceRanges.find((r) => r.range_code === rangeCode);
  const diferencial = Number(row?.diferencial ?? 0);
  if (Number.isFinite(diferencial) && diferencial > 0) return diferencial;
  return DEFAULT_ZONE_SURCHARGE[rangeCode] ?? 200;
}

function fmt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const truncateText = (text: string | null | undefined, maxLength = 100) =>
  (text || '').length > maxLength ? (text || '').substring(0, maxLength) + '...' : (text || '');

const generateQuoteToken = async (
  quoteId: string,
  action: string,
  recipientEmail: string,
  expiresIn = EXPIRES_IN
) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: recipientEmail,
      iss: 'quote-approval-system',
      iat: now,
      exp,
      data: { quoteId, action, recipientEmail },
    };
    const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_KEY;
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const data = encodedHeader + '.' + encodedPayload;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `${encodedHeader}.${encodedPayload}.${signatureBase64}`;
  } catch (error) {
    console.error('Error generating JWT:', error);
    return btoa(JSON.stringify({ quoteId, action, recipientEmail, exp: Math.floor(Date.now() / 1000) + expiresIn }));
  }
};

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { record, type } = await req.json();
  const notificationType = type || 'quote_pending';

  if (notificationType !== 'quote_pending') {
    return new Response(JSON.stringify({ success: false, message: 'Unknown notification type' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const quoteId = record?.id;
  if (!quoteId) {
    return new Response(JSON.stringify({ error: 'quote id required' }), { status: 400 });
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, construction_site, status, created_by, client_id, plant_id, validity_date, distance_range_code'
    )
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    console.error('Error fetching quote:', quoteError);
    return new Response(JSON.stringify({ error: quoteError?.message || 'Quote not found' }), { status: 400 });
  }

  if (quote.status !== 'PENDING_APPROVAL') {
    return new Response(JSON.stringify({ success: false, message: 'Quote already processed' }), { status: 200 });
  }

  const { data: client } = await supabase
    .from('clients')
    .select('business_name, client_code')
    .eq('id', quote.client_id)
    .single();

  let creator: { first_name?: string; last_name?: string } | null = null;
  if (quote.created_by) {
    const { data } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', quote.created_by)
      .single();
    creator = data;
  }
  const creatorName = creator ? [creator.first_name, creator.last_name].filter(Boolean).join(' ') : 'N/A';

  const { data: cashSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'cash_overprice_pct')
    .single();
  const cashOverpricePct = Number(cashSetting?.value ?? 10) || 10;

  let distanceRanges: Array<{ range_code?: string; diferencial?: number | null }> = [];
  if (quote.plant_id) {
    const { data: r } = await supabase
      .from('distance_range_configs')
      .select('range_code, diferencial')
      .eq('plant_id', quote.plant_id)
      .eq('is_active', true)
      .order('min_distance_km', { ascending: true });
    distanceRanges = r || [];
  }

  let plantBusinessUnitId: string | null = null;
  if (quote.plant_id) {
    const { data: plantRow } = await supabase
      .from('plants')
      .select('business_unit_id')
      .eq('id', quote.plant_id)
      .single();
    plantBusinessUnitId = plantRow?.business_unit_id ?? null;
  }

  const validityDate = quote.validity_date || new Date().toISOString().slice(0, 10);
  const floorLookupDate =
    validityDate && validityDate < '2026-01-01' ? new Date().toISOString().slice(0, 10) : validityDate;
  const zoneRangeCode = quote.distance_range_code as string | undefined;

  const { data: detailsData } = await supabase
    .from('quote_details')
    .select(
      `
      id, volume, base_price, final_price, profit_margin, pricing_path, includes_vat, master_recipe_id,
      pump_service, pump_price,
      recipes(recipe_code, placement_type),
      master_recipes(master_code)
    `
    )
    .eq('quote_id', quoteId);

  const details = detailsData || [];

  const enrichedDetails = await Promise.all(
    details.map(async (d: any) => {
      const recipeData = Array.isArray(d.recipes) ? d.recipes[0] : d.recipes;
      const masterData = Array.isArray(d.master_recipes) ? d.master_recipes[0] : d.master_recipes;
      const masterCode = masterData?.master_code;
      const recipeCode = recipeData?.recipe_code || masterCode || 'N/A';
      const displayCode = masterCode || recipeCode;
      const placementType = recipeData?.placement_type || 'B';
      const isListPriced = (d.pricing_path || 'COST_DERIVED') === 'LIST_PRICE' && d.master_recipe_id;
      const includesVat = d.includes_vat ?? false;

      let baseListPrice: number | null = null;
      let effectiveFloor: number | null = null;

      if (isListPriced && d.master_recipe_id) {
        const { data: floorData } = await supabase.rpc('get_effective_floor_price', {
          p_master_recipe_id: d.master_recipe_id,
          p_as_of_date: floorLookupDate,
        });
        const rawFloor = floorData?.[0]?.floor_price ?? null;
        if (rawFloor != null) {
          baseListPrice =
            !includesVat && cashOverpricePct > 0 ? rawFloor * (1 + cashOverpricePct / 100) : rawFloor;
          const zoneSurcharge = getZoneSurcharge(zoneRangeCode, distanceRanges);
          effectiveFloor =
            baseListPrice + (isZoneCOrHigher(zoneRangeCode) ? zoneSurcharge : 0);
        }
      }

      return {
        ...d,
        displayCode,
        placementType,
        isListPriced,
        baseListPrice,
        effectiveFloor,
        zoneRangeCode,
        includesVat,
      };
    })
  );

  const { data: additionalProducts } = await supabase
    .from('quote_additional_products')
    .select(`
      id, quantity, base_price, margin_percentage, unit_price, total_price,
      additional_products(name, code, unit)
    `)
    .eq('quote_id', quoteId);

  const detailSubtotal = enrichedDetails.reduce(
    (sum, d) => sum + (d.final_price || 0) * (d.volume || 0),
    0
  );
  const pumpTotal = enrichedDetails.reduce((sum, d) => {
    if (d.pump_service && d.pump_price) return sum + d.pump_price * d.volume;
    return sum;
  }, 0);
  const addlTotal = (additionalProducts || []).reduce((sum, p) => sum + (p.total_price || 0), 0);
  const totalAmount = detailSubtotal + pumpTotal + addlTotal;

  const hasPump = enrichedDetails.some((d) => d.pump_service);
  const hasVat = enrichedDetails.some((d) => d.includes_vat);
  const hasListPrice = enrichedDetails.some((d) => d.isListPriced);
  const hasCostDerived = enrichedDetails.some((d) => !d.isListPriced);

  let recipientsQuery = supabase
    .from('user_profiles')
    .select('email, first_name, last_name, role, business_unit_id, plant_id')
    .in('role', ['PLANT_MANAGER', 'EXECUTIVE']);

  if (quote.plant_id && plantBusinessUnitId) {
    recipientsQuery = recipientsQuery.or(
      `plant_id.eq.${quote.plant_id},and(business_unit_id.eq.${plantBusinessUnitId},plant_id.is.null),and(business_unit_id.is.null,plant_id.is.null)`
    );
  }

  const { data: recipients, error: recipientsError } = await recipientsQuery;

  if (recipientsError || !recipients?.length) {
    return new Response(
      JSON.stringify({ success: false, message: 'No recipients found for quote approval' }),
      { status: 200 }
    );
  }

  const emailStyles = `
    .container { font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
    .subtitle { font-size: 18px; color: #334155; margin-bottom: 15px; }
    .cards { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
    .card { flex: 1; min-width: 200px; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; }
    .card-label { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
    .card-value { font-size: 16px; font-weight: 600; color: #1e293b; }
    .card-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .info-box { background-color: #fff; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; overflow-x: auto; }
    .info-box table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .info-box th { text-align: left; padding: 10px 8px; background: #f8fafc; color: #475569; font-weight: 600; }
    .info-box td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
    .info-box .product-code { font-weight: 600; color: #1e293b; }
    .info-box .product-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
    .info-box .list-breakdown { font-size: 11px; color: #64748b; }
    .info-box .list-breakdown span { display: block; }
    .info-box .green { color: #22c55e; }
    .info-box .orange { color: #f59e0b; }
    .total-row { font-weight: 700; font-size: 14px; color: #1e293b; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .summary-row { font-size: 12px; color: #64748b; margin-top: 8px; }
    .btn-container { margin-top: 25px; }
    .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .btn-view { background-color: #3b82f6; color: white; }
  `;

  const col3Header = hasListPrice && hasCostDerived ? 'Lista base / Precio Base' : hasListPrice ? 'Lista base' : 'Precio Base';
  const col4Header = hasListPrice && hasCostDerived ? 'Piso efectivo / Margen' : hasListPrice ? 'Piso efectivo' : 'Margen';
  const col5Header =
    hasListPrice && hasCostDerived ? 'Precio de venta / Final' : hasListPrice ? 'Precio de venta' : 'Precio Final';

  const rowsHtml = enrichedDetails
    .map((d: any) => {
      const col3 = d.isListPriced
        ? (() => {
            const rawList =
              d.baseListPrice != null && !d.includesVat && cashOverpricePct > 0
                ? d.baseListPrice / (1 + cashOverpricePct / 100)
                : d.baseListPrice ?? null;
            const uplift =
              rawList != null && d.baseListPrice != null ? d.baseListPrice - rawList : null;
            if (rawList != null && uplift != null && !d.includesVat && cashOverpricePct > 0) {
              return `
                <span class="list-breakdown">
                  <span>Lista catálogo $${fmt(rawList)}</span>
                  <span class="green">+${cashOverpricePct}% contado +$${fmt(uplift)}</span>
                  <span>Lista base $${fmt(d.baseListPrice)}</span>
                </span>`;
            }
            return `$${fmt(d.baseListPrice)}`;
          })()
        : `$${fmt(d.base_price)}`;
      const col4 = d.isListPriced
        ? `$${fmt(d.effectiveFloor)}`
        : `${((d.profit_margin || 0) * 100).toFixed(1)}%`;
      const col5 = d.isListPriced
        ? (() => {
            const delta = d.effectiveFloor != null ? d.final_price - d.effectiveFloor : null;
            const deltaText =
              delta != null
                ? delta >= 0
                  ? `$${fmt(delta)} sobre piso`
                  : `$${fmt(Math.abs(delta))} bajo piso`
                : '';
            return `$${fmt(d.final_price)}${deltaText ? `<br><span class="${delta >= 0 ? 'green' : 'orange'}">${deltaText}</span>` : ''}`;
          })()
        : `$${fmt(d.final_price)}`;

      const zoneBadge =
        d.isListPriced && d.zoneRangeCode
          ? ` <span style="background:#e2e8f0;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600;">Zona ${d.zoneRangeCode}</span>`
          : '';

      return `
        <tr>
          <td>
            <span class="product-code">${d.displayCode}</span>
            <span class="product-meta">${d.placementType === 'D' ? 'Directa' : 'Bombeado'}${zoneBadge}</span>
          </td>
          <td>${d.volume} m³</td>
          <td>${col3}</td>
          <td>${col4}</td>
          <td>${col5}</td>
        </tr>`;
    })
    .join('');

  const additionalRowsHtml =
    additionalProducts && additionalProducts.length > 0
      ? `
      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #e2e8f0;">
        <div class="card-label" style="margin-bottom:10px;">Productos adicionales</div>
        <table style="width:100%;font-size:13px;">
          <thead><tr><th style="text-align:left;padding:8px;">Producto</th><th>Cant.</th><th>P. Base</th><th>Margen</th><th>Total</th></tr></thead>
          <tbody>
            ${(additionalProducts as any[])
              .map(
                (p) =>
                  `<tr>
                    <td>${p.additional_products?.name || 'N/A'}</td>
                    <td>${p.quantity} ${p.additional_products?.unit || ''}</td>
                    <td>$${fmt(p.base_price)}</td>
                    <td>${(p.margin_percentage || 0).toFixed(1)}%</td>
                    <td>$${fmt(p.total_price)}</td>
                  </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
      : '';

  const baseUrl = FRONTEND_URL.startsWith('http') ? FRONTEND_URL : `https://${FRONTEND_URL}`;

  for (const recipient of recipients) {
    const approveToken = await generateQuoteToken(quoteId, 'approve', recipient.email);
    const rejectToken = await generateQuoteToken(quoteId, 'reject', recipient.email);
    const approveUrl = `${baseUrl}/api/quote-actions/direct-action?quoteId=${quoteId}&action=approve&email=${encodeURIComponent(recipient.email)}`;
    const rejectUrl = `${baseUrl}/api/quote-actions/direct-action?quoteId=${quoteId}&action=reject&email=${encodeURIComponent(recipient.email)}`;
    const viewUrl = `${baseUrl}/quotes`;

    const emailContent = `
      <html><head><style>${emailStyles}</style></head><body>
      <div class="container">
        <div class="header">
          <h1 class="title">Autorización de cotización requerida</h1>
          <h2 class="subtitle">${quote.quote_number || 'Cotización'}</h2>
        </div>
        <div class="cards">
          <div class="card">
            <div class="card-label">Cliente</div>
            <div class="card-value">${client?.business_name || 'N/A'}</div>
            <div class="card-sub">${client?.client_code || ''}</div>
          </div>
          <div class="card">
            <div class="card-label">Obra</div>
            <div class="card-value">${quote.construction_site || 'N/A'}</div>
            <div class="card-sub">Creado por: ${creatorName}</div>
          </div>
        </div>
        <div class="info-box">
          <table>
            <thead><tr><th>Producto</th><th>Volumen</th><th>${col3Header}</th><th>${col4Header}</th><th>${col5Header}</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${additionalRowsHtml}
          <div class="total-row">Total cotización: $${fmt(totalAmount)}</div>
          <div class="summary-row">Incluye bombeo: ${hasPump ? 'Sí' : 'No'} | Incluye IVA: ${hasVat ? 'Sí' : 'No'}</div>
        </div>
        <div class="btn-container">
          <a href="${approveUrl}" class="btn btn-approve">Aprobar</a>
          <a href="${rejectUrl}" class="btn btn-reject">Rechazar</a>
          <a href="${viewUrl}" class="btn btn-view">Ver detalles</a>
        </div>
      </div></body></html>
    `;

    await supabase.from('quote_action_tokens').upsert(
      {
        quote_id: quoteId,
        recipient_email: recipient.email,
        approve_token: approveToken,
        reject_token: rejectToken,
        expires_at: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
      },
      { onConflict: 'quote_id,recipient_email' }
    );

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient.email }] }],
        from: { email: 'juan.aguirre@dssolutions-mx.com' },
        subject: `Autorización de cotización requerida - ${quote.quote_number || 'Cotización'}`,
        content: [{ type: 'text/html', value: emailContent }],
      }),
    });

    if (res.ok) {
      await supabase.from('quote_notifications').insert({
        quote_id: quoteId,
        notification_type: 'QUOTE_APPROVAL_REQUEST',
        recipient: recipient.email,
        delivery_status: 'SENT',
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
});
