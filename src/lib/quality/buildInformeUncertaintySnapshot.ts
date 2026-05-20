import type { MeasurandCodigo } from '@/types/ema-uncertainty';
import type { InformeUncertaintyEntry } from '@/types/informe-ensayo';
import { formatUncertaintyDisplay } from '@/lib/quality/informeConformidad';
import { getDeclaredUForMeasurand } from '@/services/emaUncertaintyService';
import {
  fcMeasurandForTipo,
  requiredMeasurandsForMuestreo,
  type RequiredMeasurand,
} from '@/lib/quality/informeMeasurands';

export { fcMeasurandForTipo, requiredMeasurandsForMuestreo, type RequiredMeasurand };

type PublishedRow = Awaited<ReturnType<typeof getDeclaredUForMeasurand>>;

function toEntry(
  codigo: MeasurandCodigo,
  row: NonNullable<PublishedRow>,
  meta?: {
    measurand_nombre?: string;
    metodo_norma?: string | null;
    documento_codigo?: string | null;
    u_relativa_pct?: number | null;
  }
): InformeUncertaintyEntry {
  const u = Number(row.u_expandida);
  const k = Number(row.k_factor) || 2;
  return {
    measurand_codigo: codigo,
    measurand_nombre: meta?.measurand_nombre ?? codigo,
    metodo_norma: meta?.metodo_norma ?? null,
    u_expandida: u,
    k_factor: k,
    nu_eff: row.nu_eff != null ? Number(row.nu_eff) : null,
    unidad: row.unidad ?? '',
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    study_id: row.study_id,
    documento_codigo: meta?.documento_codigo ?? null,
    u_relativa_pct: meta?.u_relativa_pct ?? null,
    display: formatUncertaintyDisplay(u, row.unidad ?? '', k),
  };
}

export async function buildInformeUncertaintySnapshot(
  required: RequiredMeasurand[],
  asOfDate: string
): Promise<{ entries: InformeUncertaintyEntry[]; missing: RequiredMeasurand[] }> {
  const entries: InformeUncertaintyEntry[] = [];
  const missing: RequiredMeasurand[] = [];

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = await createServiceClient();

  for (const req of required) {
    const row = await getDeclaredUForMeasurand(req.codigo, asOfDate);
    if (!row) {
      missing.push(req);
      continue;
    }

    const [{ data: measurand }, { data: study }, { data: budget }] = await Promise.all([
      supabase.from('ema_uncertainty_measurands').select('nombre, metodo_norma').eq('codigo', req.codigo).maybeSingle(),
      supabase.from('ema_uncertainty_studies').select('documento_codigo').eq('id', row.study_id).maybeSingle(),
      supabase.from('ema_uncertainty_study_budget').select('u_relativa_pct').eq('study_id', row.study_id).maybeSingle(),
    ]);

    entries.push(
      toEntry(req.codigo, row, {
        measurand_nombre: (measurand as { nombre?: string } | null)?.nombre ?? req.codigo,
        metodo_norma: (measurand as { metodo_norma?: string } | null)?.metodo_norma ?? null,
        documento_codigo: (study as { documento_codigo?: string } | null)?.documento_codigo ?? null,
        u_relativa_pct: (budget as { u_relativa_pct?: number } | null)?.u_relativa_pct ?? null,
      })
    );
  }

  return { entries, missing };
}
