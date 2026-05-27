'use client';

import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi';
import { Beaker, ExternalLink } from 'lucide-react';
import type { LaboratorioLoteMuestreo, LaboratorioLoteStatus } from '@/types/laboratorioLote';

type Props = {
  loteId: string;
  status: LaboratorioLoteStatus;
  muestreos: LaboratorioLoteMuestreo[];
};

export default function ExperimentoMuestreosPanel({ loteId, status, muestreos }: Props) {
  const hasMuestreos = muestreos.length > 0;

  return (
    <section className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">Muestreos y muestras</h2>
        {status === 'borrador' && (
          <Link href={`/quality/muestreos/new?mode=experimento&laboratorio_lote_id=${loteId}`}>
            <Button size="sm" className={qualityHubPrimaryButtonClass}>
              <Beaker className="h-3.5 w-3.5 mr-1" />
              Planificar muestras
            </Button>
          </Link>
        )}
      </div>

      {!hasMuestreos ? (
        <div className="p-6 text-center text-sm text-stone-500">
          {status === 'borrador' ? (
            <>
              <p className="mb-3">Aún no hay muestreo vinculado.</p>
              <Link href={`/quality/muestreos/new?mode=experimento&laboratorio_lote_id=${loteId}`}>
                <Button className={qualityHubPrimaryButtonClass}>Planificar muestras (muestreo)</Button>
              </Link>
            </>
          ) : (
            <p>No hay muestreos registrados para este lote.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {muestreos.map((m) => (
            <div key={m.id} className="p-4">
              <Link
                href={`/quality/muestreos/${m.id}`}
                className="text-sky-700 hover:underline inline-flex items-center gap-1 text-sm font-medium mb-2"
              >
                Muestreo #{m.numero_muestreo ?? '—'} — {formatDate(m.fecha_muestreo, 'dd/MM/yyyy')}
                <ExternalLink className="h-3 w-3" />
              </Link>
              {(m.muestras ?? []).length === 0 ? (
                <p className="text-xs text-stone-500">Sin muestras planificadas</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {(m.muestras ?? []).map((mu) => {
                    const lastEnsayo = (mu.ensayos ?? [])[mu.ensayos!.length - 1];
                    const pending = !lastEnsayo && mu.estado !== 'ensayado';
                    return (
                      <li
                        key={mu.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm border border-stone-100 rounded-md px-3 py-2 bg-stone-50/50"
                      >
                        <div>
                          <span className="font-medium">{mu.identificacion ?? mu.tipo_muestra}</span>
                          <span className="text-stone-500 text-xs ml-2">
                            {mu.fecha_programada_ensayo
                              ? formatDate(mu.fecha_programada_ensayo, 'dd/MM/yyyy')
                              : ''}
                          </span>
                          {lastEnsayo?.resistencia_calculada != null && (
                            <span className="text-xs text-stone-600 block mt-0.5">
                              FC: {Number(lastEnsayo.resistencia_calculada).toFixed(1)} kg/cm²
                              {lastEnsayo.porcentaje_cumplimiento != null &&
                                ` (${Number(lastEnsayo.porcentaje_cumplimiento).toFixed(0)}%)`}
                            </span>
                          )}
                        </div>
                        {pending && (
                          <Link href={`/quality/ensayos/new?muestra_id=${mu.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              Registrar ensayo
                            </Button>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
