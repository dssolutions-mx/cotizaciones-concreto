'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, Package, Calendar, Beaker } from 'lucide-react';
import Link from 'next/link';
import type { LaboratorioLoteWithRelations } from '@/types/laboratorioLote';
import { PROTOCOL_TYPE_LABELS } from '@/types/laboratorioLote';
import { formatDate } from '@/lib/utils';

type Props = {
  lote: LaboratorioLoteWithRelations | null;
  onChange?: () => void;
};

export default function LoteExperimentoInfoCard({ lote, onChange }: Props) {
  if (!lote) {
    return (
      <CardContent className="flex justify-center items-center p-6">
        <p className="text-stone-500">Cargando lote de experimento…</p>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4">
      <div className="p-4 border border-violet-200 rounded-lg bg-violet-50/60">
        <div className="flex items-start gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-violet-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-lg text-stone-900">{lote.study_name}</h3>
            <p className="text-sm text-violet-800">{lote.lote_number}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-stone-500" />
            <span>{PROTOCOL_TYPE_LABELS[lote.protocol_type] ?? lote.protocol_type}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-stone-500" />
            <span>{formatDate(lote.fecha, 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-stone-500" />
            <span>
              {lote.volumen_m3} m³
              {lote.recipe?.recipe_code ? ` · Ref. ${lote.recipe.recipe_code}` : ''}
            </span>
          </div>
        </div>
        <Link
          href={`/quality/experimentos/${lote.id}`}
          className="text-xs text-sky-700 hover:underline mt-3 inline-block"
        >
          Ver detalle del experimento
        </Link>
      </div>
      {onChange && (
        <Button type="button" variant="outline" size="sm" onClick={onChange}>
          Cambiar lote
        </Button>
      )}
    </CardContent>
  );
}
