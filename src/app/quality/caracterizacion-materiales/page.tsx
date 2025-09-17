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
  Search,
  ArrowLeft
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Componentes de agregados
import FormularioAgregados from '@/components/agregados/FormularioAgregados';
import DetalleEstudioAgregados from '@/components/agregados/DetalleEstudioAgregados';
import ListaEstudiosAgregados from '@/components/agregados/ListaEstudiosAgregados';
import { 
  EstudioAgregados, 
  VistaListaAgregados, 
  FormularioAgregados as FormularioAgregadosType 
} from '@/types/agregados';

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

// Datos de ejemplo para estudios de agregados
const mockEstudiosAgregados: VistaListaAgregados[] = [
  {
    id: '1',
    fechaCreacion: '2024-01-15T10:30:00Z',
    cliente: 'Constructora ABC',
    plantaProcedencia: 'P1',
    tipoMaterial: 'Arena Volcánica 40-4 mm',
    estado: 'aprobado',
    tecnicoResponsable: 'Ing. María González',
    estudiosRealizados: ['Masa Específica', 'Absorción', 'Granulometría']
  },
  {
    id: '2',
    fechaCreacion: '2024-01-10T14:20:00Z',
    cliente: 'Desarrollos XYZ',
    plantaProcedencia: 'P2',
    tipoMaterial: 'Grava Basáltica 19-4 mm',
    estado: 'completado',
    tecnicoResponsable: 'Tec. Carlos Ruiz',
    estudiosRealizados: ['Masa Específica', 'Masa Volumétrica', 'Pérdida por Lavado']
  },
  {
    id: '3',
    fechaCreacion: '2024-01-08T09:15:00Z',
    cliente: 'Concretos del Norte',
    plantaProcedencia: 'P1',
    tipoMaterial: 'Agregado Mixto 25-4 mm',
    estado: 'borrador',
    tecnicoResponsable: 'Ing. Ana López',
    estudiosRealizados: ['Granulometría']
  }
];

// Datos de ejemplo para estudio completo
const mockEstudioCompleto: EstudioAgregados = {
  id: '1',
  fechaCreacion: '2024-01-15T10:30:00Z',
  fechaActualizacion: '2024-01-15T16:45:00Z',
  datosGenerales: {
    minaProcedencia: 'Mina San Juan',
    ubicacion: 'Km 45 Carretera Federal',
    tamanoGrava: '40-4 (1/2)',
    origenGrava: 'Volcánica',
    muestreaPor: 'Ing. María González',
    cliente: 'Constructora ABC',
    idMuestra: 'AGR-2024-001',
    plantaProcedencia: 'P1'
  },
  masaEspecifica: {
    a: 0.9,
    b: 0.6,
    c: 0.25,
    v: 0.34,
    ms: 0.888,
    messsCalculado: 2.65,
    mesCalculado: 2.65,
    meCalculado: 1.35
  },
  absorcion: {
    masaMuestraSSS: 0.9,
    masaMuestraSeca: 0.888,
    porcentajeAbsorcion: 1.35
  },
  perdidaPorLavado: {
    secadoMasaConstante: true,
    masaMuestraSeca: 1231,
    masaMuestraSecaLavada: 1222,
    porcentajePerdida: 0.7
  },
  granulometria: {
    tamanoGrava: '40-4 mm (1/2)',
    datos: [
      { noMalla: '2', retenidoG: 0, porcentajeRetenido: 0.0, porcentajeAcumulado: 0.0, porcentajePasa: 100.0 },
      { noMalla: '1 1/2', retenidoG: 3230, porcentajeRetenido: 2.8, porcentajeAcumulado: 2.8, porcentajePasa: 97.21 },
      { noMalla: '1', retenidoG: 111120, porcentajeRetenido: 96.1, porcentajeAcumulado: 98.9, porcentajePasa: 1.09 },
      { noMalla: '3/4', retenidoG: 1080, porcentajeRetenido: 0.9, porcentajeAcumulado: 99.8, porcentajePasa: 0.15 },
      { noMalla: '1/2', retenidoG: 140, porcentajeRetenido: 0.1, porcentajeAcumulado: 100.0, porcentajePasa: 0.03 },
      { noMalla: '3/8', retenidoG: 20, porcentajeRetenido: 0.0, porcentajeAcumulado: 100.0, porcentajePasa: 0.01 },
      { noMalla: 'Charola', retenidoG: 17, porcentajeRetenido: 0.0, porcentajeAcumulado: 100.0, porcentajePasa: 0.0 }
    ],
    total: 115607,
    graficaData: {
      x: ['2', '1 1/2', '1', '3/4', '1/2', '3/8'],
      y: [100.0, 97.21, 1.09, 0.15, 0.03, 0.01]
    }
  },
  estado: 'aprobado',
  tecnicoResponsable: 'Ing. María González',
  supervisorAprobacion: 'Ing. Roberto Martínez',
  fechaAprobacion: '2024-01-15T16:45:00Z'
};

type VistaActual = 'lista' | 'formulario' | 'detalle';

export default function CaracterizacionMaterialesPage() {
  const [activeTab, setActiveTab] = useState<MaterialType>('agregados');
  const [vistaActual, setVistaActual] = useState<VistaActual>('lista');
  const [estudiosAgregados, setEstudiosAgregados] = useState<VistaListaAgregados[]>(mockEstudiosAgregados);
  const [estudioSeleccionado, setEstudioSeleccionado] = useState<string | null>(null);
  const [modoFormulario, setModoFormulario] = useState<'crear' | 'editar'>('crear');

  const getAnalysisCount = (type: MaterialType) => {
    if (type === 'agregados') {
      return estudiosAgregados.length;
    }
    return mockAnalyses.filter(analysis => analysis.type === type).length;
  };

  // Funciones para manejar estudios de agregados
  const handleNuevoEstudioAgregados = () => {
    setModoFormulario('crear');
    setVistaActual('formulario');
  };

  const handleEditarEstudioAgregados = (id: string) => {
    setEstudioSeleccionado(id);
    setModoFormulario('editar');
    setVistaActual('formulario');
  };

  const handleVerDetalleAgregados = (id: string) => {
    setEstudioSeleccionado(id);
    setVistaActual('detalle');
  };

  const handleGuardarEstudioAgregados = (datos: FormularioAgregadosType) => {
    console.log('Guardando estudio de agregados:', datos);
    // Aquí se implementaría la lógica para guardar en la base de datos
    setVistaActual('lista');
  };

  const handleCancelarFormulario = () => {
    setVistaActual('lista');
    setEstudioSeleccionado(null);
  };

  const handleDescargarPDF = (id: string) => {
    console.log('Descargando PDF del estudio:', id);
    // Aquí se implementaría la lógica para generar y descargar el PDF
  };

  const volverALista = () => {
    setVistaActual('lista');
    setEstudioSeleccionado(null);
  };

  // Renderizar vista de agregados según el estado actual
  const renderVistaAgregados = () => {
    switch (vistaActual) {
      case 'formulario':
        return (
          <FormularioAgregados
            onGuardar={handleGuardarEstudioAgregados}
            onCancelar={handleCancelarFormulario}
            modo={modoFormulario}
          />
        );
      
      case 'detalle':
        return (
          <div>
            <Button
              variant="ghost"
              onClick={volverALista}
              className="mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la lista
            </Button>
            <DetalleEstudioAgregados
              estudio={mockEstudioCompleto}
              onEditar={() => handleEditarEstudioAgregados(estudioSeleccionado!)}
              onDescargarPDF={() => handleDescargarPDF(estudioSeleccionado!)}
            />
          </div>
        );
      
      default:
        return (
          <ListaEstudiosAgregados
            estudios={estudiosAgregados}
            onVerDetalle={handleVerDetalleAgregados}
            onEditar={handleEditarEstudioAgregados}
            onNuevoEstudio={handleNuevoEstudioAgregados}
            onDescargarPDF={handleDescargarPDF}
          />
        );
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Encabezado principal */}
      {vistaActual === 'lista' && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Caracterización de Materiales</h1>
            <p className="text-gray-600 mt-2">
              Gestión de análisis y estudios de materiales por planta
            </p>
          </div>
        </div>
      )}

      {/* Tabs de Materiales - Solo mostrar en vista de lista */}
      {vistaActual === 'lista' && (
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
          <TabsContent value="agregados" className="space-y-6">
            {renderVistaAgregados()}
          </TabsContent>

          {/* Otras pestañas mantienen la funcionalidad original */}
          {Object.keys(materialLabels)
            .filter(key => key !== 'agregados')
            .map((materialType) => (
              <TabsContent key={materialType} value={materialType} className="space-y-6">
                <MaterialSection 
                  materialType={materialType as MaterialType}
                  analyses={mockAnalyses.filter(analysis => analysis.type === materialType)}
                />
              </TabsContent>
            ))}
        </Tabs>
      )}

      {/* Vista completa para formulario y detalle */}
      {vistaActual !== 'lista' && renderVistaAgregados()}
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
  const [selectedAggregate, setSelectedAggregate] = useState<string>('all');
  const [certificateName, setCertificateName] = useState<string>('');
  const [certificateDate, setCertificateDate] = useState<string>('');
  const [certificateProvider, setCertificateProvider] = useState<string>('');

  // Para agregados, mostramos estudios internos con filtro
  if (materialType === 'agregados') {
    return (
      <div className="space-y-6">
        {/* Sección de Estudios Internos con Filtro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Estudios Realizados Internamente - {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filtro para agregados específicos */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium">Filtrar por agregado:</label>
                </div>
                <Select value={selectedAggregate} onValueChange={setSelectedAggregate}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Seleccionar agregado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los agregados</SelectItem>
                    <SelectItem value="arena_volcanica">Arena Volcánica</SelectItem>
                    <SelectItem value="arena_basaltica">Arena Basáltica</SelectItem>
                    <SelectItem value="grava_19mm">Grava 19mm</SelectItem>
                    <SelectItem value="grava_40mm">Grava 40mm</SelectItem>
                    <SelectItem value="agregado_fino">Agregado Fino</SelectItem>
                    <SelectItem value="agregado_grueso">Agregado Grueso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lista de estudios internos */}
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
                            <span>Estudio Interno</span>
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
                  <p>No hay estudios internos registrados para el agregado seleccionado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sección de Certificados de Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Certificados del Proveedor - {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Subir certificados del proveedor</h3>
                <p className="text-gray-500 mb-4">
                  Arrastra y suelta archivos aquí, o haz clic para seleccionar
                </p>
                <Button variant="outline">
                  Seleccionar Archivos
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Producto</label>
                  <Input
                    value={certificateName}
                    onChange={(e) => setCertificateName(e.target.value)}
                    placeholder="ej. Arena Volcánica Tipo A"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha del Certificado</label>
                  <Input
                    type="date"
                    value={certificateDate}
                    onChange={(e) => setCertificateDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Proveedor</label>
                  <Input
                    value={certificateProvider}
                    onChange={(e) => setCertificateProvider(e.target.value)}
                    placeholder="Nombre del proveedor"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline">Cancelar</Button>
                <Button>Subir Certificado</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Para agua, cemento y aditivos, solo certificados de proveedor
  return (
    <div className="space-y-6">
      {/* Sección de Visualización de Certificados Subidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Certificados Subidos - {label}
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
                          <span>Proveedor: {analysis.supplier}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[analysis.status]}>
                        {statusLabels[analysis.status]}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Certificado
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Icon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay certificados subidos para {label.toLowerCase()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección de Subida de Certificados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Certificados del Proveedor - {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Subir certificados del proveedor</h3>
              <p className="text-gray-500 mb-4">
                Arrastra y suelta archivos aquí, o haz clic para seleccionar
              </p>
              <Button variant="outline">
                Seleccionar Archivos
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Producto</label>
                <Input
                  value={certificateName}
                  onChange={(e) => setCertificateName(e.target.value)}
                  placeholder={`ej. ${label} Tipo Premium`}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha del Certificado</label>
                <Input
                  type="date"
                  value={certificateDate}
                  onChange={(e) => setCertificateDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Proveedor</label>
                <Input
                  value={certificateProvider}
                  onChange={(e) => setCertificateProvider(e.target.value)}
                  placeholder="Nombre del proveedor"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button>Subir Certificado</Button>
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
