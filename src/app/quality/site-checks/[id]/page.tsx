'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { siteChecksService } from '@/services/siteChecksService';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function SiteCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const record = await siteChecksService.getSiteCheckById(id);
        setData(record);
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar el registro');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Button variant="outline" onClick={() => router.push('/quality')} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Calidad
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Registro en obra</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Cargando...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : !data ? (
            <div>No encontrado</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Remisión</div>
                <div className="font-medium">{data.remision?.remision_number || data.remision_number_manual}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Planta</div>
                <div className="font-medium">{data.plant?.name || data.plant_id}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Fecha</div>
                <div className="font-medium">{new Date(data.fecha_muestreo).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Tipo de prueba</div>
                <div className="font-medium">{data.test_type}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Inicial (cm)</div>
                <div className="font-medium">{data.valor_inicial_cm ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Final (cm)</div>
                <div className="font-medium">{data.valor_final_cm ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Temp. ambiente</div>
                <div className="font-medium">{data.temperatura_ambiente ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Temp. concreto</div>
                <div className="font-medium">{data.temperatura_concreto ?? '-'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm text-gray-500">Observaciones</div>
                <div className="font-medium">{data.observaciones || '-'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


