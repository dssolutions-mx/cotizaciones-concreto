'use client';

import ExperimentoConformidadBadge from '@/components/quality/experimentos/ExperimentoConformidadBadge';
import {
  resolveTargetFc,
  summarizeLoteConformidad,
} from '@/lib/quality/laboratorioConformidad';
import { formatMoldeInstrumentoDisplay } from '@/lib/quality/moldeInstrumentoDisplay';
import { formatDate } from '@/lib/utils';
import type { LaboratorioLote, LaboratorioLoteMuestreo } from '@/types/laboratorioLote';

type Props = {
  lote: LaboratorioLote;
  referenceStrengthFc?: number | null;
  muestreos: LaboratorioLoteMuestreo[];
};

export default function ExperimentoResultadosPanel({ lote, referenceStrengthFc, muestreos }: Props) {
  const targetFc = resolveTargetFc({ ...lote, recipe: { strength_fc: referenceStrengthFc } });
  const conformidad = summarizeLoteConformidad(targetFc, muestreos);

  const rows: Array<{
    identificacion: string;
    fc: number;
    pct: number | null;
    fecha?: string | null;
  }> = [];

  for (const m of muestreos) {
    for (const mu of m.muestras ?? []) {
      for (const e of mu.ensayos ?? []) {
        if (e.resistencia_calculada != null) {
          rows.push({
            identificacion: formatMoldeInstrumentoDisplay(
              (mu as { molde_instrumento?: { codigo?: string | null; nombre?: string | null } })
                .molde_instrumento,
              mu.identificacion ?? mu.tipo_muestra,
            ),
            fc: Number(e.resistencia_calculada),
            pct: e.porcentaje_cumplimiento != null ? Number(e.porcentaje_cumplimiento) : null,
            fecha: e.fecha_ensayo,
          });
        }
      }
    }
  }

  if (rows.length === 0) return null;

  const specs = lote.concrete_specs;
  const confDetail =
    conformidad.bestFc != null && conformidad.targetFc != null
      ? `Mejor: ${conformidad.bestFc.toFixed(1)} kg/cm² vs f'c ${conformidad.targetFc}`
      : undefined;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-emerald-900">Resultados de ensayo</h2>
        <ExperimentoConformidadBadge status={conformidad.status} showDetail={confDetail} />
      </div>
      {targetFc != null && (
        <p className="text-xs text-emerald-800 mb-3">
          Objetivo: {targetFc} kg/cm²
          {specs?.valor_edad != null &&
            ` · Edad: ${specs.valor_edad} ${specs.unidad_edad === 'HORA' ? 'h' : 'd'}`}
        </p>
      )}
      <ul className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex justify-between gap-4 text-stone-800">
            <span>
              {r.identificacion}
              {r.fecha && (
                <span className="text-stone-500 text-xs ml-1">
                  ({formatDate(r.fecha, 'dd/MM/yyyy')})
                </span>
              )}
            </span>
            <span className="font-medium">
              {r.fc.toFixed(1)} kg/cm²
              {r.pct != null && (
                <span className={r.pct >= 100 ? ' text-emerald-700' : ' text-amber-700'}>
                  {' '}
                  ({r.pct.toFixed(0)}%)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {lote.outcome_notes && (
        <div className="mt-4 pt-3 border-t border-emerald-200 text-sm text-stone-700">
          <p className="font-medium text-stone-900 mb-1">Conclusión</p>
          {lote.outcome_notes}
        </div>
      )}
    </section>
  );
}
