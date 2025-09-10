'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Beaker, 
  Droplets, 
  Mountain, 
  FlaskConical,
  Upload,
  Calendar,
  FileText,
  Plus,
  Eye,
  Filter
} from 'lucide-react';
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { subMonths } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Tipos para los materiales
type MaterialType = 'agregados' | 'agua' | 'cemento' | 'aditivos';

interface MaterialAnalysis {
  id: string;
  type: MaterialType;
  date: string;
  plant: string;
  status: 'pending' | 'approved' | 'rejected';
  studyName: string;
  supplier?: string;
}

// Datos de ejemplo
const mockAnalyses: MaterialAnalysis[] = [
  {
    id: '1',
    type: 'agregados',
    date: '2024-01-15',
    plant: 'P1',
    status: 'approved',
    studyName: 'Análisis granulométrico - Arena',
    supplier: 'Proveedor A'
  },
  {
    id: '2',
    type: 'cemento',
    date: '2024-01-10',
    plant: 'P2',
    status: 'pending',
    studyName: 'Análisis químico - Cemento CPC 30R',
    supplier: 'Cemex'
  },
  {
    id: '3',
    type: 'agua',
    date: '2024-01-08',
    plant: 'P1',
    status: 'approved',
    studyName: 'Análisis fisicoquímico - Agua de mezclado',
    supplier: 'Pozo propio'
  }
];

const materialIcons = {
  agregados: Mountain,
  agua: Droplets,
  cemento: Beaker,
  aditivos: FlaskConical
};

const materialLabels = {
  agregados: 'Agregados',
  agua: 'Agua',
  cemento: 'Cemento',
  aditivos: 'Aditivos'
};

const statusLabels = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado'
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

export default function CaracterizacionMaterialesPage() {
  const [activeTab, setActiveTab] = useState<MaterialType>('agregados');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date()
  });
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredAnalyses = mockAnalyses.filter(analysis => {
    const matchesType = analysis.type === activeTab;
    const matchesPlant = selectedPlant === 'all' || analysis.plant === selectedPlant;
    const matchesStatus = selectedStatus === 'all' || analysis.status === selectedStatus;
    return matchesType && matchesPlant && matchesStatus;
  });

  const getAnalysisCount = (type: MaterialType) => {
    return mockAnalyses.filter(analysis => analysis.type === type).length;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Caracterización de Materiales</h1>
          <p className="text-gray-600 mt-2">
            Gestión de análisis y estudios de materiales por planta
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Análisis
        </Button>
      </div>

      {/* Filtros Globales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rango de Fechas</label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Planta</label>
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  <SelectItem value="P1">Planta 1</SelectItem>
                  <SelectItem value="P2">Planta 2</SelectItem>
                  <SelectItem value="P3">Planta 3</SelectItem>
                  <SelectItem value="P4">Planta 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Materiales */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MaterialType)}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(materialLabels).map(([key, label]) => {
            const Icon = materialIcons[key as MaterialType];
            const count = getAnalysisCount(key as MaterialType);
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Contenido de cada pestaña */}
        {Object.keys(materialLabels).map((materialType) => (
          <TabsContent key={materialType} value={materialType} className="space-y-6">
            <MaterialSection 
              materialType={materialType as MaterialType}
              analyses={filteredAnalyses}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface MaterialSectionProps {
  materialType: MaterialType;
  analyses: MaterialAnalysis[];
}

function MaterialSection({ materialType, analyses }: MaterialSectionProps) {
  const Icon = materialIcons[materialType];
  const label = materialLabels[materialType];

  return (
    <div className="space-y-6">
      {/* Sección de Visualización de Estudios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Estudios por Periodo - {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyses.length > 0 ? (
              <div className="grid gap-4">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-blue-600" />
                      <div>
                        <h4 className="font-medium">{analysis.studyName}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Fecha: {analysis.date}</span>
                          <span>Planta: {analysis.plant}</span>
                          {analysis.supplier && <span>Proveedor: {analysis.supplier}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[analysis.status]}>
                        {statusLabels[analysis.status]}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Detalle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Icon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay estudios registrados para {label.toLowerCase()} en el período seleccionado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección de Subida de Estudios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Nuevos Estudios - {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Subir archivos de análisis</h3>
              <p className="text-gray-500 mb-4">
                Arrastra y suelta archivos aquí, o haz clic para seleccionar
              </p>
              <Button variant="outline">
                Seleccionar Archivos
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Análisis</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAnalysisTypesForMaterial(materialType).map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Planta</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar planta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">Planta 1</SelectItem>
                    <SelectItem value="P2">Planta 2</SelectItem>
                    <SelectItem value="P3">Planta 3</SelectItem>
                    <SelectItem value="P4">Planta 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button>Subir Análisis</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Función auxiliar para obtener tipos de análisis por material
function getAnalysisTypesForMaterial(materialType: MaterialType) {
  const analysisTypes = {
    agregados: [
      { value: 'granulometrico', label: 'Análisis Granulométrico' },
      { value: 'densidad', label: 'Densidad y Absorción' },
      { value: 'desgaste', label: 'Desgaste Los Angeles' },
      { value: 'sanidad', label: 'Sanidad' },
      { value: 'impurezas', label: 'Impurezas Orgánicas' },
      { value: 'equivalente_arena', label: 'Equivalente de Arena' }
    ],
    agua: [
      { value: 'fisicoquimico', label: 'Análisis Fisicoquímico' },
      { value: 'ph', label: 'pH' },
      { value: 'sulfatos', label: 'Contenido de Sulfatos' },
      { value: 'cloruros', label: 'Contenido de Cloruros' },
      { value: 'solidos_totales', label: 'Sólidos Totales Disueltos' }
    ],
    cemento: [
      { value: 'quimico', label: 'Análisis Químico' },
      { value: 'fisico', label: 'Análisis Físico' },
      { value: 'finura', label: 'Finura Blaine' },
      { value: 'tiempo_fraguado', label: 'Tiempo de Fraguado' },
      { value: 'expansion', label: 'Expansión en Autoclave' },
      { value: 'resistencia', label: 'Resistencia a Compresión' }
    ],
    aditivos: [
      { value: 'densidad', label: 'Densidad' },
      { value: 'ph', label: 'pH' },
      { value: 'solidos', label: 'Contenido de Sólidos' },
      { value: 'cloruros', label: 'Contenido de Cloruros' },
      { value: 'compatibilidad', label: 'Compatibilidad con Cemento' }
    ]
  };

  return analysisTypes[materialType] || [];
}
