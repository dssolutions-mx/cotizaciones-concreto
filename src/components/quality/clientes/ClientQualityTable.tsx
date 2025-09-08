'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

interface ClientQualityTableProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function ClientQualityTable({ data, summary }: ClientQualityTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge variant="default">Excelente</Badge>;
      case 'pending':
        return <Badge variant="secondary">Aceptable</Badge>;
      case 'non_compliant':
        return <Badge variant="destructive">Requiere Atención</Badge>;
      default:
        return <Badge variant="outline">Sin Datos</Badge>;
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (remisionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(remisionId)) {
      newExpanded.delete(remisionId);
    } else {
      newExpanded.add(remisionId);
    }
    setExpandedRows(newExpanded);
  };

  // Filter and sort data
  const filteredData = data.remisiones
    .filter(remision =>
      remision.remisionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remision.constructionSite.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remision.recipeCode.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortField as keyof typeof a];
      let bValue: any = b[sortField as keyof typeof b];

      // Handle date sorting
      if (sortField === 'fecha') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

  const exportToCSV = () => {
    const headers = [
      'Número de Remisión',
      'Fecha',
      'Obra',
      'Receta',
      'Fc Receta',
      'Volumen (m³)',
      'Muestreos',
      'Ensayos',
      'Resistencia Promedio',
      'Cumplimiento (%)',
      'Estado'
    ];

    const csvData = filteredData.map(remision => [
      remision.remisionNumber,
      formatDate(remision.fecha),
      remision.constructionSite,
      remision.recipeCode,
      remision.recipeFc,
      remision.volume,
      remision.muestreos.length,
      remision.muestreos.reduce((sum, m) => sum + m.muestras.reduce((sSum, s) => sSum + s.ensayos.length, 0), 0),
      remision.avgResistencia ? formatNumber(remision.avgResistencia, 1) : '-',
      remision.muestreos.length > 0 ? formatNumber(
        (remision.muestreos.reduce((sum, m) =>
          sum + m.muestras.reduce((sSum, s) =>
            sSum + s.ensayos.filter(e => e.isEdadGarantia && e.porcentajeCumplimiento >= 100).length, 0
          ), 0
        ) / remision.muestreos.reduce((sum, m) =>
          sum + m.muestras.reduce((sSum, s) =>
            sSum + s.ensayos.filter(e => e.isEdadGarantia).length, 0
          ), 0
        )) * 100 || 0, 1
      ) : '0',
      remision.complianceStatus
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analisis-calidad-${summary.clientInfo.business_name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por remisión, obra o receta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {filteredData.length} de {data.remisiones.length} remisiones
              </span>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Remisiones y Calidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('remisionNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Remisión
                      {sortField === 'remisionNumber' && (
                        sortDirection === 'asc' ?
                          <ChevronUp className="h-4 w-4" /> :
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('fecha')}
                  >
                    <div className="flex items-center gap-1">
                      Fecha
                      {sortField === 'fecha' && (
                        sortDirection === 'asc' ?
                          <ChevronUp className="h-4 w-4" /> :
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Receta</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 text-right"
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      Volumen (m³)
                      {sortField === 'volume' && (
                        sortDirection === 'asc' ?
                          <ChevronUp className="h-4 w-4" /> :
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Muestreos</TableHead>
                  <TableHead className="text-center">Ensayos</TableHead>
                  <TableHead className="text-right">Resistencia Promedio</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((remision) => (
                  <React.Fragment key={remision.id}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(remision.id)}
                        >
                          {expandedRows.has(remision.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {remision.remisionNumber}
                      </TableCell>
                      <TableCell>{formatDate(remision.fecha)}</TableCell>
                      <TableCell>{remision.constructionSite}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {remision.recipeCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(remision.volume)}
                      </TableCell>
                      <TableCell className="text-center">
                        {remision.muestreos.length}
                      </TableCell>
                      <TableCell className="text-center">
                        {remision.muestreos.reduce((sum, m) =>
                          sum + m.muestras.reduce((sSum, s) =>
                            sSum + s.ensayos.length, 0
                          ), 0
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {remision.avgResistencia ?
                          `${formatNumber(remision.avgResistencia, 1)} kg/cm²` :
                          '-'
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        {getComplianceBadge(remision.complianceStatus)}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row Details */}
                    {expandedRows.has(remision.id) && (
                      <TableRow>
                        <TableCell colSpan={11} className="bg-gray-50">
                          <div className="p-4">
                            <h4 className="font-medium mb-2">Detalle de Muestreos</h4>
                            {remision.muestreos.map((muestreo, idx) => (
                              <div key={muestreo.id} className="mb-4 p-3 bg-white rounded border">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Fecha Muestreo:</span> {formatDate(muestreo.fechaMuestreo)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Número:</span> {muestreo.numeroMuestreo}
                                  </div>
                                  <div>
                                    <span className="font-medium">Masa Unitaria:</span> {formatNumber(muestreo.masaUnitaria)} kg/m³
                                  </div>
                                  <div>
                                    <span className="font-medium">Temperatura Ambiente:</span> {muestreo.temperaturaAmbiente}°C
                                  </div>
                                  <div>
                                    <span className="font-medium">Temperatura Concreto:</span> {muestreo.temperaturaConcreto}°C
                                  </div>
                                  <div>
                                    <span className="font-medium">Revenimiento:</span> {muestreo.revenimientoSitio} cm
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <h5 className="font-medium mb-2">Muestras y Ensayos:</h5>
                                  {muestreo.muestras.map((muestra) => (
                                    <div key={muestra.id} className="mb-2 p-2 bg-gray-50 rounded">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium">
                                          {muestra.tipoMuestra} - {muestra.identificacion}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                          Programado: {formatDate(muestra.fechaProgramadaEnsayo)}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {muestra.ensayos.map((ensayo) => (
                                          <div key={ensayo.id} className="text-xs p-2 bg-white rounded border">
                                            <div>Fecha: {formatDate(ensayo.fechaEnsayo)}</div>
                                            <div>Carga: {ensayo.cargaKg} kg</div>
                                            <div>Resistencia: {formatNumber(ensayo.resistenciaCalculada, 1)} kg/cm²</div>
                                            <div>Cumplimiento: {formatNumber(ensayo.porcentajeCumplimiento, 1)}%</div>
                                            {ensayo.isEdadGarantia && (
                                              <Badge variant="outline" className="mt-1">Edad Garantía</Badge>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No se encontraron remisiones que coincidan con la búsqueda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
