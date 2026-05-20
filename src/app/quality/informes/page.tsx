'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import QualityHubLayout from '@/components/quality/QualityHubLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type InformeRow = {
  id: string;
  numero: string;
  estado: string;
  issued_at: string | null;
  muestreo_id: string;
  muestreos?: { fecha_muestreo?: string; numero_muestreo?: number };
};

export default function InformesIndexPage() {
  const { currentPlant } = usePlantContext();
  const [rows, setRows] = useState<InformeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentPlant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/informes?plant_id=${currentPlant.id}`);
      const json = await res.json();
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <QualityHubLayout
      title="Informes emitidos"
      description="Documentos formales ISO/IEC 17025 §7.8 (DC-LC-7.8-01)"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando informes…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-stone-500 py-8">No hay informes emitidos para esta planta.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Card key={row.id} className="border-stone-200">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{row.numero}</CardTitle>
                  <Badge variant={row.estado === 'emitido' ? 'default' : 'secondary'}>{row.estado}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-stone-600">
                {row.issued_at && (
                  <p>
                    Emitido{' '}
                    {format(new Date(row.issued_at), "d MMM yyyy", { locale: es })}
                  </p>
                )}
                <Link
                  href={`/quality/muestreos/${row.muestreo_id}`}
                  className="text-[#1B365D] underline underline-offset-2 text-sm"
                >
                  Ver muestreo
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </QualityHubLayout>
  );
}
