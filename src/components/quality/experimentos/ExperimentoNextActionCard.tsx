'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi';
import { Beaker, Pencil, ClipboardCheck } from 'lucide-react';
import type { LaboratorioLoteStatus } from '@/types/laboratorioLote';

type Props = {
  loteId: string;
  status: LaboratorioLoteStatus;
  hasMuestreo: boolean;
  onCloseProtocol: () => void;
  onOpenConclusion: () => void;
};

export default function ExperimentoNextActionCard({
  loteId,
  status,
  hasMuestreo,
  onCloseProtocol,
  onOpenConclusion,
}: Props) {
  if (status === 'evaluado') {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        Protocolo evaluado. Revisa resultados y conclusión abajo.
      </div>
    );
  }

  if (status === 'borrador') {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-900">Siguiente paso</p>
          <p className="text-xs text-violet-700 mt-0.5">
            {hasMuestreo
              ? 'Revisa el muestreo o edita la mezcla antes de continuar.'
              : 'Registra el muestreo y planifica cilindros o vigas.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/quality/experimentos/${loteId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar mezcla
            </Button>
          </Link>
          <Link href={`/quality/muestreos/new?mode=experimento&laboratorio_lote_id=${loteId}`}>
            <Button className={qualityHubPrimaryButtonClass}>
              <Beaker className="h-4 w-4 mr-1" />
              Planificar muestras
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'muestreado') {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-sky-900">Siguiente paso</p>
          <p className="text-xs text-sky-800 mt-0.5">Registra ensayos en las fechas programadas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/quality/ensayos">
            <Button variant="outline" size="sm">
              Ir a ensayos
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={onCloseProtocol}>
            Cerrar protocolo
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'cerrado') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-900">Siguiente paso</p>
          <p className="text-xs text-amber-800 mt-0.5">Documenta la conclusión del protocolo.</p>
        </div>
        <Button className={qualityHubPrimaryButtonClass} onClick={onOpenConclusion}>
          <ClipboardCheck className="h-4 w-4 mr-1" />
          Registrar conclusión
        </Button>
      </div>
    );
  }

  return null;
}
