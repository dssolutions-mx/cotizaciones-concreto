'use client';

import React, { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  BarChart2, 
  PieChart,
  FileBarChart2,
  AlertTriangle,
  Filter,
  Loader2
} from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchResistenciaReporteData, 
  fetchEficienciaReporteData,
  fetchDistribucionResistenciaData,
  fetchTendenciaResistenciaData
} from '@/services/qualityService';
import dynamic from 'next/dynamic';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// Importar dinámicamente los componentes de gráficos
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ReportesPage() {
  const { profile } = useAuth();
  
  // Estados para filtrado
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date()
  });
  const [selectedPlanta, setSelectedPlanta] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('tabla');
  
  // Estados para datos
  const [tablaData, setTablaData] = useState<any[]>([]);
  const [eficienciaData, setEficienciaData] = useState<any[]>([]);
  const [distribucionData, setDistribucionData] = useState<any[]>([]);
  const [tendenciaData, setTendenciaData] = useState<{categories: string[], series: number[]}>({
    categories: [],
    series: []
  });
  
  // Estado de carga
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  // Cargar datos al cambiar filtros
  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar datos según la pestaña activa
      if (activeTab === 'tabla') {
        const data = await fetchResistenciaReporteData(
          dateRange?.from,
          dateRange?.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion
        );
        setTablaData(data);
      } 
      else if (activeTab === 'grafico') {
        const data = await fetchTendenciaResistenciaData(
          dateRange?.from,
          dateRange?.to,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion
        );
        setTendenciaData(data);
      }
      else if (activeTab === 'eficiencia') {
        const data = await fetchEficienciaReporteData(
          dateRange?.from,
          dateRange?.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta
        );
        setEficienciaData(data);
      }
      else if (activeTab === 'distribucion') {
        const data = await fetchDistribucionResistenciaData(
          dateRange?.from,
          dateRange?.to,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion
        );
        setDistribucionData(data);
      }
    } catch (err) {
      console.error('Error cargando datos de reportes:', err);
      setError('Error al cargar los datos del reporte');
    } finally {
      setLoading(false);
    }
  };
  
  // Efecto para cargar datos iniciales
  useEffect(() => {
    if (hasAccess) {
      loadReportData();
    }
  }, [activeTab, hasAccess]);
  
  // Opciones para el gráfico de tendencia
  const tendenciaChartOptions = {
    chart: {
      type: 'line' as const,
      height: 350,
      toolbar: { show: true }
    },
    xaxis: {
      categories: tendenciaData.categories,
      title: { text: 'Mes/Año' }
    },
    yaxis: {
      min: 0,
      max: Math.max(120, ...tendenciaData.series) + 10,
      title: { text: 'Promedio de Cumplimiento (%)' },
      labels: {
        formatter: (value: number) => `${value.toFixed(0)}%`
      }
    },
    annotations: {
      yaxis: [{
        y: 100,
        borderColor: '#FF4560',
        label: {
          borderColor: '#FF4560',
          style: {
            color: '#fff',
            background: '#FF4560'
          },
          text: '100% Cumplimiento'
        }
      }]
    },
    stroke: {
      curve: 'smooth' as const,
      width: 3
    },
    colors: ['#3EB56D'],
    markers: {
      size: 5
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    }
  };
  
  // Opciones para el gráfico de distribución
  const distribucionChartOptions = {
    chart: {
      type: 'pie' as const,
      height: 350,
    },
    labels: distribucionData.map(d => d.rango),
    colors: distribucionData.map(d => d.color),
    legend: {
      position: 'bottom' as const
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom' as const
        }
      }
    }],
    tooltip: {
      y: {
        formatter: (value: number) => `${value} muestras`
      }
    }
  };
  
  // Exportar a Excel
  const exportToExcel = () => {
    try {
      const dataToExport = activeTab === 'tabla' ? tablaData : 
                           activeTab === 'eficiencia' ? eficienciaData : [];
      
      if (!dataToExport || dataToExport.length === 0) {
        setError('No hay datos para exportar');
        return;
      }
      
      // Formatear datos para exportación
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
      
      // Guardar archivo
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
      
      const fileName = `reporte_calidad_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      saveAs(data, fileName);
    } catch (err) {
      console.error('Error exportando a Excel:', err);
      setError('Error al exportar los datos');
    }
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a los reportes de calidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Reportes de Calidad</h1>
          <p className="text-gray-500">
            Genera informes y análisis de calidad del concreto
          </p>
        </div>
      </div>
      
      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Período</p>
              <DatePickerWithRange
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Planta</p>
              <Select value={selectedPlanta} onValueChange={setSelectedPlanta}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las plantas" />
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
              <p className="text-sm font-medium mb-2">Clasificación</p>
              <Select value={selectedClasificacion} onValueChange={setSelectedClasificacion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las clasificaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="FC">FC</SelectItem>
                  <SelectItem value="MR">MR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button onClick={loadReportData} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cargando...
                </>
              ) : (
                'Aplicar Filtros'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Contenedor de reportes */}
      <Tabs defaultValue="tabla" className="mb-6" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tabla">Tabla de Datos</TabsTrigger>
          <TabsTrigger value="grafico">Gráfico de Tendencias</TabsTrigger>
          <TabsTrigger value="eficiencia">Eficiencia</TabsTrigger>
          <TabsTrigger value="distribucion">Distribución</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tabla">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Datos de Resistencia por Ensayo</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                disabled={loading || !tablaData.length}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha Ensayo</TableHead>
                      <TableHead>Muestra</TableHead>
                      <TableHead>Clasificación</TableHead>
                      <TableHead>Edad (días)</TableHead>
                      <TableHead className="text-right">Carga (kg)</TableHead>
                      <TableHead className="text-right">Resistencia (kg/cm²)</TableHead>
                      <TableHead className="text-right">Cumplimiento (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Cargando datos...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : tablaData.length > 0 ? (
                      tablaData.map((dato) => (
                        <TableRow key={dato.id}>
                          <TableCell>{dato.fechaEnsayo}</TableCell>
                          <TableCell>{dato.muestra}</TableCell>
                          <TableCell>{dato.clasificacion}</TableCell>
                          <TableCell>{dato.edadDias}</TableCell>
                          <TableCell className="text-right">{dato.cargaKg.toLocaleString('es-MX')}</TableCell>
                          <TableCell className="text-right">{dato.resistencia.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span 
                              className={`font-semibold ${
                                dato.cumplimiento >= 100 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {dato.cumplimiento.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                          No hay datos disponibles para el período seleccionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="grafico">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tendencia de Resistencia</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                disabled={loading || tendenciaData.categories.length === 0}
              >
                <FileBarChart2 className="h-4 w-4 mr-2" />
                Exportar Imagen
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    <p className="text-gray-500">Cargando datos...</p>
                  </div>
                </div>
              ) : tendenciaData.categories.length > 0 && tendenciaData.series.length > 0 ? (
                <div className="h-[400px] border rounded-md p-4">
                  {typeof window !== 'undefined' && (
                    <Chart 
                      options={tendenciaChartOptions}
                      series={[{ name: 'Cumplimiento', data: tendenciaData.series }]}
                      type="line"
                      height={350}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <BarChart2 className="h-12 w-12 text-gray-300" />
                    <p className="text-gray-500">
                      No hay datos suficientes para generar el gráfico
                    </p>
                    <p className="text-xs text-gray-400">
                      Intente modificar los filtros o seleccionar otro período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="eficiencia">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Análisis de Eficiencia</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                disabled={loading || !eficienciaData.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Datos
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    <p className="text-gray-500">Cargando datos de eficiencia...</p>
                  </div>
                </div>
              ) : eficienciaData.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead>Receta</TableHead>
                        <TableHead className="text-right">Vol. Real (m³)</TableHead>
                        <TableHead className="text-right">Rendimiento (%)</TableHead>
                        <TableHead className="text-right">Resistencia (kg/cm²)</TableHead>
                        <TableHead className="text-right">Eficiencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eficienciaData.map((dato) => (
                        <TableRow key={dato.id}>
                          <TableCell>{dato.fecha}</TableCell>
                          <TableCell>{dato.planta}</TableCell>
                          <TableCell>{dato.receta}</TableCell>
                          <TableCell className="text-right">{dato.volumeReal.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{dato.rendimientoVolumetrico.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{dato.resistenciaPromedio.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{dato.eficiencia.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <BarChart2 className="h-12 w-12 text-gray-300" />
                    <p className="text-gray-500">
                      No hay datos de eficiencia disponibles
                    </p>
                    <p className="text-xs text-gray-400">
                      Intente modificar los filtros o seleccionar otro período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="distribucion">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Distribución de Resistencias</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                disabled={loading || !distribucionData.some(d => d.cantidad > 0)}
              >
                <PieChart className="h-4 w-4 mr-2" />
                Exportar Gráfico
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    <p className="text-gray-500">Cargando datos de distribución...</p>
                  </div>
                </div>
              ) : distribucionData.some(d => d.cantidad > 0) ? (
                <div className="h-[400px] border rounded-md p-4">
                  {typeof window !== 'undefined' && (
                    <Chart 
                      options={distribucionChartOptions}
                      series={distribucionData.map(d => d.cantidad)}
                      type="pie"
                      height={350}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <PieChart className="h-12 w-12 text-gray-300" />
                    <p className="text-gray-500">
                      No hay datos suficientes para generar el gráfico
                    </p>
                    <p className="text-xs text-gray-400">
                      Intente modificar los filtros o seleccionar otro período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Opciones de descarga y generación de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Exportar a Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Descarga los datos completos de ensayos en formato Excel
            </p>
            <Button 
              onClick={exportToExcel}
              disabled={loading || (activeTab === 'tabla' ? !tablaData.length : activeTab === 'eficiencia' ? !eficienciaData.length : true)} 
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generar Reporte PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Genera un reporte completo en formato PDF
            </p>
            <Button variant="outline" className="w-full" disabled={loading}>
              <FileText className="h-4 w-4 mr-2" />
              Generar PDF
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Análisis Avanzado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Genera un análisis estadístico avanzado
            </p>
            <Button variant="secondary" className="w-full" disabled={loading}>
              <BarChart2 className="h-4 w-4 mr-2" />
              Generar Análisis
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 