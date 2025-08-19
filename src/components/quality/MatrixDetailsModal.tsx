'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Calculator, Download, Edit, Trash2, Eye, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MatrixDetailsModalProps {
  matrixId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface MatrixDetails {
  id: string;
  no_matrix: string;
  created_at: string;
  plant: {
    code: string;
    name: string;
  };
  diseños: Array<{
    id: string;
    no_muestra: string;
    nombre_muestra: string;
    origen_cemento: string;
    tipo_cemento: string;
    kg_cemento: number;
    consumo_agua: number;
    origen_ag: string;
    tamaño_ag: string;
    condicion_aditivo: string;
    rev_diseño: number;
    masaunitaria_diseño: number;
  }>;
}

export default function MatrixDetailsModal({ matrixId, onClose, onUpdate }: MatrixDetailsModalProps) {
  const [matrixDetails, setMatrixDetails] = useState<MatrixDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar detalles de la matriz
  useEffect(() => {
    const loadMatrixDetails = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('id_matrix')
          .select(`
            id,
            no_matrix,
            created_at,
            plant:plant_id (
              code,
              name
            ),
            diseños:diseños_matrix (
              id,
              no_muestra,
              nombre_muestra,
              origen_cemento,
              tipo_cemento,
              kg_cemento,
              consumo_agua,
              origen_ag,
              tamaño_ag,
              condicion_aditivo,
              rev_diseño,
              masaunitaria_diseño
            )
          `)
          .eq('id', matrixId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setMatrixDetails(data as MatrixDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar detalles');
      } finally {
        setLoading(false);
      }
    };

    loadMatrixDetails();
  }, [matrixId]);

  // Función para exportar matriz a CSV
  const exportarMatriz = () => {
    if (!matrixDetails) return;

    const csvContent = [
      'No_Matriz,Planta,No_Muestra,Nombre_Muestra,Origen_Cemento,Tipo_Cemento,Kg_Cemento,Consumo_Agua,Relacion_AC,Origen_Agregados,Tamaño_Agregado,Condicion_Aditivo,Rev_Diseño,Masa_Unitaria',
      ...matrixDetails.diseños.map(d => 
        `${matrixDetails.no_matrix},${matrixDetails.plant.code},${d.no_muestra},"${d.nombre_muestra}","${d.origen_cemento}",${d.tipo_cemento},${d.kg_cemento},${d.consumo_agua},${(d.consumo_agua / d.kg_cemento).toFixed(3)},"${d.origen_ag}",${d.tamaño_ag},"${d.condicion_aditivo}",${d.rev_diseño},${d.masaunitaria_diseño}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matriz_${matrixDetails.no_matrix}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="bg-white/90 backdrop-blur">
        <CardContent className="p-6">
          <div className="text-center">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-pulse" />
            <p>Cargando detalles de la matriz...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !matrixDetails) {
    return (
      <Card className="bg-white/90 backdrop-blur">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error || 'No se pudieron cargar los detalles'}</AlertDescription>
          </Alert>
          <Button onClick={onClose} className="mt-4">Cerrar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5" />
              <div>
                <CardTitle>Detalles de Matriz: {matrixDetails.no_matrix}</CardTitle>
                <p className="text-sm text-gray-500">
                  {matrixDetails.plant.code} - {matrixDetails.plant.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarMatriz}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de la matriz */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-sm text-blue-600 font-medium">Total Diseños</div>
            <div className="text-2xl font-bold text-blue-900">
              {matrixDetails.diseños.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-sm text-green-600 font-medium">a/c Promedio</div>
            <div className="text-2xl font-bold text-green-900">
              {matrixDetails.diseños.length > 0 
                ? (matrixDetails.diseños.reduce((sum, d) => sum + (d.consumo_agua / d.kg_cemento), 0) / matrixDetails.diseños.length).toFixed(3)
                : '0.000'
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-sm text-amber-600 font-medium">Cemento Promedio</div>
            <div className="text-2xl font-bold text-amber-900">
              {matrixDetails.diseños.length > 0 
                ? Math.round(matrixDetails.diseños.reduce((sum, d) => sum + d.kg_cemento, 0) / matrixDetails.diseños.length)
                : 0
              }
            </div>
            <div className="text-xs text-amber-600">kg/m³</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="text-sm text-purple-600 font-medium">Fecha Creación</div>
            <div className="text-lg font-bold text-purple-900">
              {new Date(matrixDetails.created_at).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diseños detallados */}
      <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
        <CardHeader>
          <CardTitle>Diseños de Mezcla</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {matrixDetails.diseños.map((diseño, index) => (
              <Card key={diseño.id} className="bg-gray-50 border border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{diseño.no_muestra}</Badge>
                      <h4 className="font-semibold text-gray-900">{diseño.nombre_muestra}</h4>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">
                      a/c = {(diseño.consumo_agua / diseño.kg_cemento).toFixed(3)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Información del cemento */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700">Cemento</h5>
                      <div className="text-sm space-y-1">
                        <div><strong>Tipo:</strong> {diseño.tipo_cemento || 'No especificado'}</div>
                        <div><strong>Origen:</strong> {diseño.origen_cemento || 'No especificado'}</div>
                        <div><strong>Cantidad:</strong> {diseño.kg_cemento} kg/m³</div>
                      </div>
                    </div>

                    {/* Información del agua y agregados */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700">Agua y Agregados</h5>
                      <div className="text-sm space-y-1">
                        <div><strong>Agua:</strong> {diseño.consumo_agua} L/m³</div>
                        <div><strong>Origen AG:</strong> {diseño.origen_ag || 'No especificado'}</div>
                        <div><strong>Tamaño AG:</strong> {diseño.tamaño_ag || 'No especificado'}</div>
                      </div>
                    </div>

                    {/* Propiedades del concreto */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-700">Propiedades</h5>
                      <div className="text-sm space-y-1">
                        <div><strong>Revenimiento:</strong> {diseño.rev_diseño} cm</div>
                        <div><strong>Masa Unitaria:</strong> {diseño.masaunitaria_diseño} kg/m³</div>
                        <div><strong>Eficiencia:</strong> {(250 / diseño.kg_cemento).toFixed(2)} kg/cm²/kg</div>
                      </div>
                    </div>
                  </div>

                  {/* Aditivos */}
                  {diseño.condicion_aditivo && (
                    <div className="mt-4 p-3 bg-white rounded-lg border">
                      <h5 className="font-medium text-gray-700 mb-2">Condición de Aditivos</h5>
                      <p className="text-sm text-gray-600">{diseño.condicion_aditivo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
