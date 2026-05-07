import {
  createServerSupabaseClientFromRequest,
  createServiceClient,
} from '@/lib/supabase/server';
import { PORTAL_REMISION_DOCUMENTS_OR_FILTER } from '@/lib/client-portal/portalOrderEvidence';
import {
  assertPlantAllowedForPortal,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REMISION_DOCUMENT_ID_CHUNK = 120;

/** Hide money fields when portal user lacks view_prices (defense in depth vs UI). */
function stripOrderFinancialsForPortal(order: Record<string, unknown>, showPrices: boolean) {
  if (showPrices) return order;
  const o = JSON.parse(JSON.stringify(order)) as Record<string, unknown>;
  o.total_amount = null;
  o.final_amount = null;
  o.invoice_amount = null;
  const items = o.order_items as Record<string, unknown>[] | undefined;
  if (Array.isArray(items)) {
    for (const item of items) {
      item.unit_price = null;
      item.total_price = null;
      item.pump_price = null;
      item.empty_truck_price = null;
    }
  }
  const extras = o.order_additional_products as Record<string, unknown>[] | undefined;
  if (Array.isArray(extras)) {
    for (const line of extras) {
      line.unit_price = null;
      line.total_price = null;
    }
  }
  return o;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { id: orderId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const ctx = resolved.ctx;

    const canViewPrices =
      ctx.roleWithinClient === 'executive' || ctx.permissions?.view_prices === true;

    // Get order details with order items - RLS will automatically filter by client_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        client_id,
        plant_id,
        order_number,
        construction_site,
        delivery_date,
        delivery_time,
        order_status,
        client_approval_status,
        total_amount,
        final_amount,
        invoice_amount,
        elemento,
        special_requirements,
        comentarios_internos,
        requires_invoice,
        credit_status,
        rejection_reason,
        created_at,
        updated_at,
        quote_id,
        plant:plant_id(
          business_unit:business_unit_id(
            vat_rate
          )
        ),
        order_items (
          id,
          product_type,
          volume,
          unit_price,
          total_price,
          has_pump_service,
          pump_price,
          pump_volume,
          has_empty_truck_charge,
          empty_truck_volume,
          empty_truck_price
        ),
        order_additional_products (
          id,
          quantity,
          unit_price,
          total_price,
          notes,
          additional_products (
            name,
            code,
            unit
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      console.error('Error fetching order:', orderError);
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }

    const orderScoped = order as { client_id?: string; plant_id?: string | null };
    if (orderScoped.client_id !== ctx.clientId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (ctx.plantsRestricted) {
      const plantGate = assertPlantAllowedForPortal(ctx, orderScoped.plant_id ?? null);
      if (!plantGate.ok) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
    }

    const quoteId = order.quote_id as string | null | undefined;

    let privilegedEvidenceClient: ReturnType<typeof createServiceClient> | null = null;
    try {
      privilegedEvidenceClient = createServiceClient();
    } catch {
      privilegedEvidenceClient = null;
    }
    /** After order ownership checks, use service role so evidence rows always load (RLS may otherwise return []). */
    const evidenceDb = privilegedEvidenceClient ?? supabase;

    const [quoteResult, remisiones, evidenceResult] = await Promise.all([
      quoteId
        ? supabase
            .from('quotes')
            .select('quote_number, status, validity_date')
            .eq('id', quoteId)
            .single()
        : Promise.resolve({
            data: null as { quote_number: string; status: string; validity_date: string } | null,
            error: null,
          }),
      (async (): Promise<any[]> => {
        try {
          const { data: remisionesData, error: remisionesError } = await supabase
            .from('remisiones')
            .select(`
          id,
          fecha,
          volumen_fabricado,
          tipo_remision,
          remision_number,
          hora_carga,
          conductor,
          unidad,
          recipe_id,
          recipe:recipes(
            recipe_code,
            strength_fc
          )
        `)
            .eq('order_id', orderId)
            .order('fecha', { ascending: false });

          if (remisionesError) {
            console.error('Error fetching remisiones:', {
              message: remisionesError.message,
              details: remisionesError.details,
              code: remisionesError.code,
            });
            return [];
          }
          return remisionesData || [];
        } catch (error) {
          console.error('Error fetching remisiones:', error);
          return [];
        }
      })(),
      evidenceDb
        .from('order_concrete_evidence')
        .select('id, file_path, original_name, file_size, mime_type, notes, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ]);

    const quoteInfo = quoteId ? quoteResult.data : null;

    let concreteEvidence: Array<{
      id: string;
      file_path: string;
      original_name: string;
      file_size: number;
      mime_type: string;
      notes: string | null;
      created_at: string;
    }> = [];

    const evidenceError = 'error' in evidenceResult ? evidenceResult.error : null;
    const evidenceRows = 'data' in evidenceResult ? evidenceResult.data : null;
    if (evidenceError) {
      console.error('Error fetching order_concrete_evidence:', evidenceError);
    } else {
      concreteEvidence = evidenceRows || [];
    }

    const docsByRemision = new Map<
      string,
      Array<{
        id: string;
        file_path: string;
        original_name: string;
        file_size: number | null;
        mime_type: string | null;
        document_type: string | null;
        document_category: string | null;
        created_at: string;
        remision_id: string | null;
      }>
    >();

    let muestreos: any[] = [];
    let siteChecks: any[] = [];

    const remisionIds = (remisiones || []).map((r: { id: string }) => r.id as string);

    if (remisionIds.length > 0) {
      const docChunks: string[][] = [];
      for (let i = 0; i < remisionIds.length; i += REMISION_DOCUMENT_ID_CHUNK) {
        docChunks.push(remisionIds.slice(i, i + REMISION_DOCUMENT_ID_CHUNK));
      }

      const muestreosQuery = supabase
        .from('muestreos')
        .select(`
          id,
          numero_muestreo,
          fecha_muestreo,
          fecha_muestreo_ts,
          hora_muestreo,
          planta,
          remision_id,
          revenimiento_sitio,
          masa_unitaria,
          temperatura_ambiente,
          temperatura_concreto,
          muestras(
            id,
            fecha_programada_ensayo,
            fecha_programada_ensayo_ts,
            tipo_muestra,
            estado,
            identificacion,
            ensayos(
              id,
              fecha_ensayo,
              fecha_ensayo_ts,
              hora_ensayo,
              resistencia_calculada,
              porcentaje_cumplimiento,
              carga_kg,
              observaciones
            )
          )
        `)
        .in('remision_id', remisionIds)
        .order('fecha_muestreo', { ascending: false });

      const siteChecksQuery = supabase
        .from('site_checks')
        .select(`
          id,
          remision_id,
          remision_number_manual,
          plant_id,
          fecha_muestreo,
          hora_llegada_obra,
          test_type,
          valor_inicial_cm,
          fue_ajustado,
          detalle_ajuste,
          valor_final_cm,
          temperatura_ambiente,
          temperatura_concreto,
          observaciones,
          created_at
        `)
        .in('remision_id', remisionIds)
        .order('fecha_muestreo', { ascending: false });

      const documentQueries = docChunks.map((chunk) =>
        evidenceDb
          .from('remision_documents')
          .select(
            'id, file_path, original_name, file_size, mime_type, document_type, document_category, created_at, remision_id'
          )
          .in('remision_id', chunk)
          .or(PORTAL_REMISION_DOCUMENTS_OR_FILTER)
      );

      const batch2Results = await Promise.all([muestreosQuery, siteChecksQuery, ...documentQueries]);

      const muestreosRes = batch2Results[0];
      const siteChecksRes = batch2Results[1];
      const docResults = batch2Results.slice(2);

      if (muestreosRes.error) {
        console.error('Error fetching muestreos:', muestreosRes.error);
      }

      if (siteChecksRes.error) {
        console.error('Error fetching site_checks:', siteChecksRes.error);
      }

      siteChecks = siteChecksRes.data || [];

      for (const docRes of docResults) {
        if (docRes.error) {
          console.error('Error fetching remision_documents:', docRes.error);
          continue;
        }
        for (const row of docRes.data || []) {
          const rid = row.remision_id;
          if (!rid) continue;
          if (!docsByRemision.has(rid)) docsByRemision.set(rid, []);
          docsByRemision.get(rid)!.push(row);
        }
      }

      docsByRemision.forEach((arr) => {
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      const muestreosData = muestreosRes.data;
      muestreos = (muestreosData || []).map((muestreo: any) => {
        const muestrasWithAge = (muestreo.muestras || []).map((muestra: any) => {
          const ensayosWithAge = (muestra.ensayos || []).map((ensayo: any) => {
            let fechaMuestreo: Date | null = null;
            if (muestreo.fecha_muestreo_ts) {
              fechaMuestreo = new Date(muestreo.fecha_muestreo_ts);
            } else if (muestreo.fecha_muestreo && muestreo.hora_muestreo) {
              fechaMuestreo = new Date(`${muestreo.fecha_muestreo}T${muestreo.hora_muestreo}`);
            } else if (muestreo.fecha_muestreo) {
              fechaMuestreo = new Date(`${muestreo.fecha_muestreo}T12:00:00`);
            }

            let fechaEnsayo: Date | null = null;
            if (ensayo.fecha_ensayo_ts) {
              fechaEnsayo = new Date(ensayo.fecha_ensayo_ts);
            } else if (ensayo.fecha_ensayo && ensayo.hora_ensayo) {
              fechaEnsayo = new Date(`${ensayo.fecha_ensayo}T${ensayo.hora_ensayo}`);
            } else if (ensayo.fecha_ensayo) {
              fechaEnsayo = new Date(`${ensayo.fecha_ensayo}T12:00:00`);
            }

            if (!fechaMuestreo || !fechaEnsayo || isNaN(fechaMuestreo.getTime()) || isNaN(fechaEnsayo.getTime())) {
              return {
                ...ensayo,
                edad_horas: null,
                edad_dias: null,
                edad_horas_restantes: null,
                edad_display: undefined,
              };
            }

            const diffTimeMs = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
            const totalHours = Math.floor(diffTimeMs / (1000 * 60 * 60));
            const totalDays = Math.floor(diffTimeMs / (1000 * 60 * 60 * 24));
            const remainingHours = totalHours % 24;

            return {
              ...ensayo,
              edad_horas: totalHours,
              edad_dias: totalDays,
              edad_horas_restantes: remainingHours,
              edad_display:
                totalHours < 48
                  ? `${totalHours}h`
                  : remainingHours > 0
                    ? `${totalDays}d ${remainingHours}h`
                    : `${totalDays}d`,
            };
          });

          return {
            ...muestra,
            ensayos: ensayosWithAge,
          };
        });

        return {
          ...muestreo,
          muestras: muestrasWithAge,
        };
      });
    }

    // Organize data by remision (no remision_materiales / internal consumption — not for client portal)
    const remisionesWithDetails = (remisiones || []).map((remision: any) => {
      const remisionMuestreos = muestreos.filter(m => m.remision_id === remision.id);
      const remisionSiteChecks = siteChecks.filter(sc => sc.remision_id === remision.id);
      const remisionDocuments = docsByRemision.get(remision.id) || [];

      return {
        ...remision,
        muestreos: remisionMuestreos,
        site_checks: remisionSiteChecks,
        documents: remisionDocuments,
      };
    });

    const orderForClient = stripOrderFinancialsForPortal(order as Record<string, unknown>, canViewPrices);
    delete (orderForClient as { plant_id?: unknown }).plant_id;

    return NextResponse.json({
      order: orderForClient,
      canViewPrices,
      quote: quoteInfo,
      remisiones: remisionesWithDetails,
      concrete_evidence: concreteEvidence,
      summary: {
        totalRemisiones: remisiones?.length || 0,
        totalVolume: remisiones?.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0) || 0,
        totalMuestreos: muestreos.length,
        totalSiteChecks: siteChecks.length,
        totalConcreteEvidenceFiles: concreteEvidence.length,
        totalRemisionDocuments: [...docsByRemision.values()].reduce((n, a) => n + a.length, 0),
      }
    });

  } catch (error) {
    console.error('Order detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
