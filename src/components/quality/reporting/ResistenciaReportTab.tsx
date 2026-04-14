'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

export type GroupedResistenciaData = Record<
  string,
  { muestreoFecha: string; ensayos: Record<string, unknown>[] }
>;

function formatMetric(value: number | null | undefined, decimals: number = 2, suffix: string = '') {
  if (value === null || value === undefined) return 'N/A';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return `${numValue.toFixed(decimals)}${suffix}`;
}

function formatString(value: string | null | undefined) {
  return value ?? 'N/A';
}

export function ResistenciaReportTab({
  groupedTablaData,
  loading,
  onExportExcel,
}: {
  groupedTablaData: GroupedResistenciaData;
  loading: boolean;
  onExportExcel: () => void;
}) {
  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Datos de resistencia por muestreo</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={loading || Object.keys(groupedTablaData).length === 0}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-stone-200 rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={3}>Información del muestreo</TableHead>
                <TableHead>Ensayo: código muestra</TableHead>
                <TableHead>Ensayo: fecha</TableHead>
                <TableHead>Ensayo: edad (días)</TableHead>
                <TableHead className="text-right">Ensayo: carga (kg)</TableHead>
                <TableHead className="text-right">Ensayo: resistencia (kg/cm²)</TableHead>
                <TableHead className="text-right">Ensayo: cumplimiento (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-stone-500">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Cargando datos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : Object.keys(groupedTablaData).length > 0 ? (
                Object.entries(groupedTablaData).map(([muestreoId, group]) => (
                  <React.Fragment key={muestreoId}>
                    <TableRow className="bg-stone-50 hover:bg-stone-100">
                      <TableCell colSpan={3} className="font-semibold">
                        Muestreo ID: {muestreoId.startsWith('nomuestreoid') ? '-' : muestreoId}
                        <span className="ml-4 font-normal">Fecha: {formatString(group.muestreoFecha)}</span>
                      </TableCell>
                      <TableCell colSpan={6} />
                    </TableRow>
                    {group.ensayos.map((ensayo: any) => (
                      <TableRow key={ensayo.id}>
                        <TableCell colSpan={3} />
                        <TableCell>{formatString(ensayo.muestraCodigo)}</TableCell>
                        <TableCell>{formatString(ensayo.fechaEnsayo)}</TableCell>
                        <TableCell>{formatString(ensayo.edadDias)}</TableCell>
                        <TableCell className="text-right">{formatMetric(ensayo.cargaKg, 0)}</TableCell>
                        <TableCell className="text-right">{formatMetric(ensayo.resistencia)}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              (ensayo.cumplimiento ?? 0) >= 100 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatMetric(ensayo.cumplimiento, 2, '%')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-stone-500">
                    No hay datos disponibles para los filtros seleccionados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
