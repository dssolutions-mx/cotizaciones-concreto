'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePlantContext } from '@/contexts/PlantContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface CrossPlantRemision {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  conductor: string | null;
  cross_plant_billing_remision_id: string | null;
  cross_plant_billing_plant_id: string | null;
  billing_plant?: { name: string } | null;
  billing_remision?: { remision_number: string } | null;
}

const formatDateSafely = (dateStr: string) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return format(new Date(year, month - 1, day, 12), 'dd/MM/yyyy', { locale: es });
};

export default function CrossPlantProductionList() {
  const { currentPlant } = usePlantContext();
  const [remisiones, setRemisiones] = useState<CrossPlantRemision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentPlant?.id) return;
    fetchCrossPlantRemisiones();
  }, [currentPlant?.id]);

  const fetchCrossPlantRemisiones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          conductor,
          cross_plant_billing_remision_id,
          cross_plant_billing_plant_id
        `)
        .eq('plant_id', currentPlant!.id)
        .eq('is_production_record', true)
        .order('fecha', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch billing plant names and remision numbers separately
      const enriched: CrossPlantRemision[] = await Promise.all(
        (data || []).map(async (r) => {
          let billingPlantName: string | null = null;
          let billingRemisionNumber: string | null = null;

          if (r.cross_plant_billing_plant_id) {
            const { data: plant } = await supabase
              .from('plants')
              .select('name')
              .eq('id', r.cross_plant_billing_plant_id)
              .maybeSingle();
            billingPlantName = plant?.name ?? null;
          }

          if (r.cross_plant_billing_remision_id) {
            const { data: rem } = await supabase
              .from('remisiones')
              .select('remision_number')
              .eq('id', r.cross_plant_billing_remision_id)
              .maybeSingle();
            billingRemisionNumber = rem?.remision_number ?? null;
          }

          return {
            ...r,
            billing_plant: billingPlantName ? { name: billingPlantName } : null,
            billing_remision: billingRemisionNumber ? { remision_number: billingRemisionNumber } : null,
          };
        })
      );

      setRemisiones(enriched);
    } catch (err) {
      console.error('[CrossPlantProductionList] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando producción cruzada...</span>
      </div>
    );
  }

  if (remisiones.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No hay remisiones de producción cruzada para esta planta.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Remisión</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Conductor</TableHead>
          <TableHead className="text-right">Volumen</TableHead>
          <TableHead>Planta de Facturación</TableHead>
          <TableHead>Remisión de Facturación</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remisiones.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <span>#{r.remision_number}</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded px-1 py-0.5">🏭</span>
              </div>
            </TableCell>
            <TableCell>{formatDateSafely(r.fecha)}</TableCell>
            <TableCell>{r.conductor || '-'}</TableCell>
            <TableCell className="text-right">{r.volumen_fabricado.toFixed(2)} m³</TableCell>
            <TableCell>
              {r.billing_plant
                ? <Badge variant="outline" className="text-amber-700 border-amber-300">{r.billing_plant.name}</Badge>
                : <span className="text-xs text-amber-600">Vínculo pendiente</span>
              }
            </TableCell>
            <TableCell>
              {r.billing_remision
                ? <span className="text-sm font-medium">#{r.billing_remision.remision_number}</span>
                : <span className="text-xs text-gray-400">—</span>
              }
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
